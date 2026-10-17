import { createHmac } from "node:crypto";
import { sql } from "./db.ts";
import { audit } from "@aihot/backend/audit";

/** Keep the original 10/client and 50/site password limits across stateless Worker instances. */
export async function admitPasswordAttempt(client: string, secret: string): Promise<boolean> {
  if (!secret) throw new Error("Session secret is required for password admission");
  const subject = `auth-client:${createHmac("sha256", secret).update(client).digest("hex")}`;
  return sql.begin(async tx => {
    await tx`SELECT pg_advisory_xact_lock(684903111)`;
    const [counts] = await tx<{ all: number; client: number }[]>`
      SELECT count(*)::int AS all, count(*) FILTER (WHERE subject=${subject})::int AS client
      FROM audit_log WHERE action='auth.password.attempt' AND created_at>now()-interval '15 minutes'`;
    if (counts.all >= 50 || counts.client >= 10) return false;
    await audit("auth:password", "auth.password.attempt", subject, null, null, null, { db: tx });
    return true;
  });
}
