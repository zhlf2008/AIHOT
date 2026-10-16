import { collect } from "./collect.ts";
import { CATEGORIES } from "./content.ts";
import {
  readArticles,
  readSources,
  readStats,
  readRss,
} from "./publication.ts";
import type { Env } from "./types.ts";

const headers = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    let response: Response;
    try {
      if (!["GET", "HEAD"].includes(request.method))
        response = Response.json(
          { error: "仅支持只读访问" },
          { status: 405, headers: { Allow: "GET, HEAD" } },
        );
      else if (url.pathname === "/api/articles")
        response = Response.json(await readArticles(env, url), {
          headers: { "Cache-Control": "public, max-age=120" },
        });
      else if (url.pathname === "/api/sources")
        response = Response.json(
          { items: await readSources(env) },
          { headers: { "Cache-Control": "public, max-age=300" } },
        );
      else if (url.pathname === "/api/stats")
        response = Response.json(await readStats(env), {
          headers: { "Cache-Control": "public, max-age=120" },
        });
      else if (url.pathname === "/api/categories")
        response = Response.json(CATEGORIES);
      else if (url.pathname === "/api/health") {
        await env.DB.prepare("SELECT 1").first();
        response = Response.json({
          status: "ok",
          service: "knit-fashion-hot",
          database: "connected",
        });
      } else if (url.pathname === "/feed.xml")
        response = new Response(await readRss(env, url), {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
            "Cache-Control": "public,max-age=600",
          },
        });
      else if (url.pathname === "/robots.txt")
        response = new Response("User-agent: *\nAllow: /\nDisallow: /api/\n", {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      else if (url.pathname === "/llms.txt")
        response = new Response(
          `# 针织时尚 HOT\n全球针织服装趋势阅读索引。\n公开接口：${url.origin}/api/articles\n信源：${url.origin}/api/sources\n订阅：${url.origin}/feed.xml\n标题和摘要来自公开信源，版权归原作者。原始语言，不声称人工精选或 AI 评分。日期缺失时标明收录时间。\n`,
          { headers: { "Content-Type": "text/plain; charset=utf-8" } },
        );
      else if (url.pathname.startsWith("/api/"))
        response = Response.json({ error: "接口不存在" }, { status: 404 });
      else response = await env.ASSETS.fetch(request);
    } catch (error) {
      console.error(
        "request failed",
        url.pathname,
        error instanceof Error ? error.message : "unknown error",
      );
      response = Response.json(
        { error: "服务暂时繁忙，请稍后刷新" },
        { status: 503, headers: { "Retry-After": "30" } },
      );
    }
    const secured = new Response(
      request.method === "HEAD" ? null : response.body,
      response,
    );
    for (const [key, value] of Object.entries(headers))
      secured.headers.set(key, value);
    return secured;
  },
  scheduled(_event: ScheduledController, env: Env, context: ExecutionContext) {
    context.waitUntil(collect(env));
  },
} satisfies ExportedHandler<Env>;
