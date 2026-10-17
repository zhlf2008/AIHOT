import { AsyncLocalStorage } from "node:async_hooks";
import { PgBoss, type Job, type WorkOptions } from "pg-boss";
import { sql } from "../api/db.ts";

type Handler = (jobs: Job<Record<string, unknown>>[]) => Promise<unknown>;
interface QueueState { boss: PgBoss; ensured: Set<string>; handlers: Map<string, Handler> }
const current = new AsyncLocalStorage<QueueState>();
export function taskQueueState(): QueueState {
  const state = current.getStore();
  if (!state) throw new Error("queue access outside a Worker task");
  return state;
}

/** Manual pg-boss fetch/complete retain durable claims; no polling timer survives a Workflow step. */
export async function withTaskQueues<T>(fn: () => Promise<T>): Promise<T> {
  const handlers = new Map<string, Handler>();
  const boss = new PgBoss({ schema: "pgboss", migrate: false, schedule: false, supervise: false,
    db: { executeSql: async (text, values) => {
      // pg-boss wraps queue DDL and advisory locks in its own BEGIN/COMMIT batch.
      const connection = await sql.reserve();
      try { return { rows: await connection.unsafe(text, (values ?? []) as never[]) }; }
      catch (error) { await connection.unsafe("ROLLBACK").catch(() => {}); throw error; }
      finally { connection.release(); }
    } },
  });
  boss.work = (async (name: string, options: WorkOptions | Handler, handler?: Handler) => {
    const run = typeof options === "function" ? options : handler;
    if (!run) throw new Error("Queue handler is missing");
    if (handlers.has(name)) throw new Error(`Queue handler already registered: ${name}`);
    handlers.set(name, run);
    return `workflow:${name}`;
  }) as PgBoss["work"];
  return current.run({ boss, ensured: new Set(), handlers }, fn);
}

export async function runOneQueuedJob(cursor = 0): Promise<{ queue: string; id: string; status: "completed" | "failed" } | null> {
  const { boss, handlers } = taskQueueState();
  // The original daemon runs queues concurrently. A finite Workflow must give each queue a turn,
  // otherwise an initial import can indefinitely delay analysis, grouping and publication.
  const entries = [...handlers];
  const offset = entries.length ? cursor % entries.length : 0;
  for (const [queue, handler] of [...entries.slice(offset), ...entries.slice(0, offset)]) {
    const [job] = await boss.fetch<Record<string, unknown>>(queue, { batchSize: 1,
      ...(queue === "events.group" ? { groupConcurrency: 1 } : {}),
    });
    if (!job) continue;
    try {
      const result = await handler([job]);
      await boss.complete(queue, job.id, result as object | undefined);
      return { queue, id: job.id, status: "completed" };
    } catch (error) {
      // pg-boss keeps the original retry/backoff/expiry policy; paid receipts remain the retry gate.
      const receiptId = error && typeof error === "object" && "receiptId" in error ? error.receiptId : undefined;
      await boss.fail(queue, job.id, { message: error instanceof Error ? error.message : String(error),
        ...(typeof receiptId === "number" ? { receiptId } : {}),
      });
      return { queue, id: job.id, status: "failed" };
    }
  }
  return null;
}
