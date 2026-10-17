import { sql, withDatabase } from "./db.ts";
import { mountReadonlyAssets } from "./fs.ts";
import manifest from "./.build/asset-files.json" with { type: "json" };
import type { buildPublicApp } from "./public-app.ts";
import { logError } from "@aihot/backend/lib/log-error";
import { handleAsNodeRequest } from "cloudflare:node";
import { withTaskQueues } from "../jobs/queue-context.ts";
import { admitPasswordAttempt } from "./login-limit.ts";
import { withMediaService } from "./media-context.ts";
import { hydrateUpload } from "./storage-files.ts";

interface Env { HYPERDRIVE: { connectionString: string }; MEDIA?: { fetch(request: Request): Promise<Response> } }
let app: Promise<Awaited<ReturnType<typeof buildPublicApp>>> | undefined;
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const publicApi = url.pathname.startsWith("/api/v1/") || url.pathname === "/api/mcp";
    const adminApi = url.pathname.startsWith("/api/admin/") || url.pathname.startsWith("/api/auth/");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && !publicApi && !adminApi)
      return Response.json({ code: "preview_read_only" }, { status: 503, headers: { "Cache-Control": "no-store" } });
    try {
      return await withDatabase(env.HYPERDRIVE.connectionString, () => withMediaService(env.MEDIA, () => withTaskQueues(async () => {
        if (url.pathname === "/api/health") {
          await sql`SELECT 1`;
          return Response.json({ ok: true, db: "ok", phase: "editorial-preview" }, { headers: { "Cache-Control": "no-store" } });
        }
        if (url.pathname === "/api/auth/password" && request.method === "POST" &&
            !await admitPasswordAttempt(request.headers.get("cf-connecting-ip") ?? "unknown", process.env.SESSION_SECRET ?? "")) {
          return Response.redirect(new URL("/admin/login?error=too-many", request.url), 303);
        }
        if (/^\/api\/admin\/feedback\/[^/]+\/screenshot$/.test(url.pathname)) {
          return Response.json({ code: "media_storage_pending", detail: "附件持久存储正在适配，此操作尚未开放。" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
        }
        await mountReadonlyAssets(manifest);
        const contact = /^\/contact\/(qr-(?:wechat|feishu)-[a-f0-9]{8}\.(?:png|jpg|jpeg|webp))$/.exec(url.pathname);
        if (contact) await hydrateUpload(contact[1]);
        app ??= import("./public-app.ts").then(m => m.buildPublicApp()).catch(error => { app = undefined; throw error; });
        await app;
        const response = await handleAsNodeRequest(3001, request);
        const payload = await response.arrayBuffer();
        const headers = new Headers(response.headers);
        headers.set("X-Knithot-Preview-Phase", "editorial");
        return new Response(request.method === "HEAD" || [204,304].includes(response.status) ? null : payload,
          { status: response.status, headers });
      })));
    } catch (error) {
      console.error(JSON.stringify({ msg: "read-only preview failed", error: logError(error) }));
      return Response.json({ ok: false, code: "preview_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "10" } });
    }
  },
};
