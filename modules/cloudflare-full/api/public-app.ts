// Phase two serves the engine's existing anonymous reading routes and publication contracts.
import Fastify from "fastify";
import { registerSite } from "../../../apps/api/src/routes/site.ts";
import { registerV1, registerV1Fallbacks } from "../../../apps/api/src/routes/v1.ts";
import { registerFeeds } from "../../../apps/api/src/routes/feeds.ts";
import { registerAgent } from "../../../apps/api/src/routes/agent.ts";
import { registerStatic } from "../../../apps/api/src/routes/static.ts";
import { registerMcp } from "../../../apps/api/src/routes/mcp.ts";
import { logError } from "@aihot/backend/lib/log-error";
import { registerAdminAuth } from "../../../apps/api/src/routes/admin-auth.ts";
import { registerAdmin } from "../../../apps/api/src/routes/admin.ts";
import { config } from "@aihot/backend/config";
import { adminHandler } from "../../../apps/api/src/routes/admin-auth.ts";
import { mediaService } from "./media-context.ts";
import { checkCard } from "../media/check-card.ts";
import { registerOg } from "../../../apps/api/src/routes/og.ts";
import { registerMedia } from "../../../apps/api/src/routes/media.ts";

export async function buildPublicApp() {
  if (!config.adminPassword || config.adminPassword.length < 12 || config.devAdmin) throw new Error("Production administrator credentials are required");
  const app = Fastify({ logger: false, bodyLimit: 10 * 1024 * 1024, trustProxy: false, routerOptions: { maxParamLength: 300 } });
  // The anonymous routes validate their queries and outputs explicitly. Workers disallow JIT serializers.
  app.setSerializerCompiler(() => JSON.stringify);
  app.setValidatorCompiler(() => { throw new Error("Worker route requires a precompiled schema validator"); });
  app.setChildLoggerFactory((logger, _bindings, _options, request) => {
    const child = Object.create(logger);
    for (const level of ["warn", "error", "fatal"] as const) child[level] = (fields: unknown, message?: string) => {
      const error = fields && typeof fields === "object" && "err" in fields ? fields.err : undefined;
      console.error(JSON.stringify({ level, msg: message ?? "api operation failed", path: (request.url ?? "").split("?")[0], ...(error ? { error: logError(error) } : {}) }));
    };
    return child;
  });
  registerSite(app);
  registerV1(app);
  registerFeeds(app);
  registerAgent(app);
  registerStatic(app);
  registerOg(app);
  registerMedia(app);
  registerMcp(app);
  registerAdminAuth(app);
  registerAdmin(app);
  app.post("/api/admin/media-check", adminHandler(async (_req, reply) => {
    const response = await mediaService().fetch(new Request("https://media.internal/render", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(checkCard),
    }));
    return reply.code(response.status).type(response.headers.get("Content-Type") ?? "text/plain").send(Buffer.from(await response.arrayBuffer()));
  }));
  registerV1Fallbacks(app);
  app.setErrorHandler((error, _request, reply) => {
    const status = (error as { statusCode?: number }).statusCode;
    if (status === 400 || status === 413 || status === 415) return reply.code(status).header("Cache-Control", "no-store").send({ code: "invalid_request" });
    console.error(JSON.stringify({ level: "error", msg: "public api failed", error: logError(error) }));
    return reply.code(503).header("Cache-Control", "no-store").header("Retry-After", "10").send({ code: "temporarily_unavailable" });
  });
  await app.ready();
  // Workers uses this port as an in-isolate routing key, not a listening network socket.
  app.server.listen(3001);
  return app;
}
