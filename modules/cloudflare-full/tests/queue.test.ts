import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { after, before, test } from "node:test";
import { PgBoss } from "pg-boss";
import { build } from "esbuild";
import { platformPlugin, workerBuildOptions } from "../platform-build.mjs";

const temp = await mkdtemp(path.join(os.tmpdir(), "knithot-queue-"));
const output = path.join(temp, "queue.mjs");
await build({ ...workerBuildOptions, platform: "node", conditions: ["node"], outfile: output,
  stdin: { contents: `export { withDatabase, sql } from './modules/cloudflare-full/api/db.ts';
export { withTaskQueues, taskQueueState, runOneQueuedJob } from './modules/cloudflare-full/jobs/queue-context.ts';
export { enqueue, ensureQueue, getBoss } from '@aihot/backend/jobs/queue';`, resolveDir: process.cwd(), loader: "ts" },
  plugins: [platformPlugin({ edgeQueues: true })],
});
const adapter = await import(pathToFileURL(output).href);
const runtime = (fn: () => Promise<unknown>) => adapter.withDatabase(process.env.DATABASE_URL!, () => adapter.withTaskQueues(fn));

before(async () => {
  const native = new PgBoss({ connectionString: process.env.DATABASE_URL!, schema: "pgboss", schedule: false, supervise: false });
  try { await native.start(); } finally { await native.stop({ graceful: false }); }
});
after(async () => { await rm(temp, { recursive: true, force: true }); });

test("Worker enqueues share the caller transaction and keep singleton deduplication", async () => {
  await runtime(async () => {
    await adapter.ensureQueue("content.analyze");
    await assert.rejects(adapter.sql.begin(async (tx: any) => {
      await adapter.enqueue("content.analyze", { articleId: "rolled-back" }, { singletonKey: "rolled-back" }, tx);
      throw new Error("rollback fixture");
    }), /rollback fixture/);
    const rows = await adapter.sql`SELECT id FROM pgboss.job WHERE data->>'articleId'='rolled-back'`;
    assert.equal(rows.length, 0);
    assert.ok(await adapter.enqueue("content.analyze", { articleId: "one" }, { singletonKey: "one" }));
    assert.equal(await adapter.enqueue("content.analyze", { articleId: "one" }, { singletonKey: "one" }), null);
    const boss = await adapter.getBoss();
    await boss.deleteQueuedJobs("content.analyze");
  });
});

test("event grouping is serial across separate Workflow steps and distinct article keys", async () => {
  await runtime(async () => {
    await adapter.enqueue("events.group", { articleId: "group-left" }, { singletonKey: "group-left" });
    await adapter.enqueue("events.group", { articleId: "group-right" }, { singletonKey: "group-right" });
  });
  const first = await runtime(async () => (await (await adapter.getBoss()).fetch("events.group", { groupConcurrency: 1 }))[0]);
  assert.ok(first);
  await runtime(async () => assert.equal((await (await adapter.getBoss()).fetch("events.group", { groupConcurrency: 1 })).length, 0));
  await runtime(async () => { await (await adapter.getBoss()).complete("events.group", (first as any).id); });
  const second = await runtime(async () => (await (await adapter.getBoss()).fetch("events.group", { groupConcurrency: 1 }))[0]);
  assert.ok(second);
  assert.notEqual((first as any).data.articleId, (second as any).data.articleId);
});

test("manual dispatch completes durable jobs and preserves receipt IDs on failure", async () => {
  await runtime(async () => {
    const boss = await adapter.getBoss();
    await boss.createQueue("fixture.dispatch", { retryLimit: 0 });
    await boss.send("fixture.dispatch", { fail: false });
    await boss.send("fixture.dispatch", { fail: true });
    await boss.work("fixture.dispatch", async ([job]: any[]) => {
      if (job.data.fail) throw Object.assign(new Error("receipt fixture"), { receiptId: 42 });
      return { fixture: true };
    });
    assert.equal((await adapter.runOneQueuedJob()).status, "completed");
    assert.equal((await adapter.runOneQueuedJob()).status, "failed");
    assert.equal(await adapter.runOneQueuedJob(), null);
    const [failed] = await adapter.sql`SELECT output FROM pgboss.job WHERE name='fixture.dispatch' AND state='failed'`;
    assert.equal(failed.output.receiptId, 42);
  });
});

test("a busy import queue cannot starve editorial queues in a bounded batch", async () => {
  await runtime(async () => {
    const boss = await adapter.getBoss();
    for (const name of ["fixture.import", "fixture.editorial"]) {
      await boss.createQueue(name, { retryLimit: 0 });
      await boss.work(name, async () => ({ done: true }));
    }
    for (let i = 0; i < 3; i++) await boss.send("fixture.import", { i });
    await boss.send("fixture.editorial", {});
    assert.equal((await adapter.runOneQueuedJob(0)).queue, "fixture.import");
    assert.equal((await adapter.runOneQueuedJob(1)).queue, "fixture.editorial");
    const [remaining] = await adapter.sql`SELECT count(*)::int AS count FROM pgboss.job WHERE name='fixture.import' AND state='created'`;
    assert.equal(remaining.count, 2);
  });
});
