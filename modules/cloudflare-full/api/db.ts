// The engine keeps its SQL contracts; a Worker owns connections only for its current request/task.
import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";

export type Sql = ReturnType<typeof postgres>;
export type Tx = postgres.TransactionSql;
export type Db = Sql | Tx;
const current = new AsyncLocalStorage<Sql>();
function connection(): Sql {
  const db = current.getStore();
  if (!db) throw new Error("database access outside a Worker request or task");
  return db;
}
export const sql = new Proxy(function () {} as unknown as Sql, {
  apply(_target, _this, args) { return Reflect.apply(connection(), undefined, args); },
  get(_target, key) { return Reflect.get(connection(), key); },
});

const numberType = (oid: number) => ({ to: oid, from: [oid], serialize: (value: unknown) => String(value), parse: (value: string) => Number(value) });
export async function withDatabase<T>(connectionString: string, fn: () => Promise<T>): Promise<T> {
  const db = postgres(connectionString, { max: 3, idle_timeout: 5, connect_timeout: 10,
    connection: { jit: "off" }, onnotice: () => {}, types: { int8: numberType(20), numeric: numberType(1700) } });
  return current.run(db, async () => {
    try { return await fn(); }
    finally { await db.end({ timeout: 5 }); }
  });
}
export function withCustomPlans<T>(fn: (db: Tx) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => { await tx`SET LOCAL plan_cache_mode = force_custom_plan`; return fn(tx); }) as Promise<T>;
}
export async function closeDb(): Promise<void> { await current.getStore()?.end({ timeout: 5 }); }
export function one<T>(rows: readonly T[]): T { if (rows[0] === undefined) throw new Error("expected one row"); return rows[0]; }
