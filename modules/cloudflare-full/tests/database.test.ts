import assert from "node:assert/strict";
import { test } from "node:test";
import { gate } from "../../../tests/setup.ts";
import { sql, withDatabase, withCustomPlans } from "../api/db.ts";

test("overlapping Worker requests keep their own database context", async () => {
  const leftReady = gate<void>();
  const rightReady = gate<void>();
  async function request(name: string, entered: typeof leftReady, other: typeof rightReady) {
    const url = new URL(process.env.DATABASE_URL!);
    url.searchParams.set("application_name", name);
    return withDatabase(url.toString(), async () => {
      await sql`SELECT 1`;
      entered.open();
      await other.promise;
      // Read through the shared export after both contexts are active.
      const [row] = await sql`SELECT current_setting('application_name') AS name`;
      return row.name;
    });
  }
  assert.deepEqual(await Promise.all([
    request("left-request", leftReady, rightReady),
    request("right-request", rightReady, leftReady),
  ]), ["left-request", "right-request"]);
  assert.throws(() => sql`SELECT 1`, /outside a Worker request/);
});

test("Worker database cleanup also runs after failure and custom plans stay transaction-local", async () => {
  await assert.rejects(withDatabase(process.env.DATABASE_URL!, async () => {
    await sql`SELECT 1`;
    throw new Error("task failed");
  }), /task failed/);
  assert.throws(() => sql`SELECT 1`, /outside a Worker request/);
  await withDatabase(process.env.DATABASE_URL!, async () => {
    await withCustomPlans(async tx => {
      const [row] = await tx`SHOW plan_cache_mode`;
      assert.equal(row.plan_cache_mode, "force_custom_plan");
    });
    const [row] = await sql`SHOW plan_cache_mode`;
    assert.equal(row.plan_cache_mode, "auto");
  });
});
