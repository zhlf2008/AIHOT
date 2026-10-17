import assert from "node:assert/strict";
import { test } from "node:test";
import { sql, withDatabase } from "../api/db.ts";
import { admitPasswordAttempt } from "../api/login-limit.ts";

test("password admission is atomic across Worker contexts and stores only keyed client hashes", async () => {
  const secret = "local-fixture-secret-for-password-admission";
  const results = await Promise.all(Array.from({ length: 20 }, () =>
    withDatabase(process.env.DATABASE_URL!, () => admitPasswordAttempt("192.0.2.10", secret))));
  assert.equal(results.filter(Boolean).length, 10);
  await withDatabase(process.env.DATABASE_URL!, async () => {
    const rows = await sql`SELECT subject FROM audit_log WHERE action='auth.password.attempt'`;
    assert.equal(rows.length, 10);
    assert.ok(rows.every(row => /^auth-client:[0-9a-f]{64}$/.test(row.subject)));
    assert.equal(new Set(rows.map(row => row.subject)).size, 1);
    await sql`DELETE FROM audit_log WHERE action='auth.password.attempt'`;
  });
});

test("the global password cap holds across changing clients and missing secrets fail closed", async () => {
  await withDatabase(process.env.DATABASE_URL!, async () => {
    await assert.rejects(admitPasswordAttempt("fixture", ""), /secret/);
    for (let i = 0; i < 50; i++) assert.equal(await admitPasswordAttempt(`fixture-${i}`, "local-only-secret"), true);
    assert.equal(await admitPasswordAttempt("fixture-new-client", "local-only-secret"), false);
    const [row] = await sql`SELECT count(*)::int AS count FROM audit_log WHERE action='auth.password.attempt'`;
    assert.equal(row.count, 50);
  });
});
