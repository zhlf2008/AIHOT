import sourcesJson from "../../../industry/source-directory.json" with { type: "json" };
import { parseFeed, parseWeb } from "./content.ts";
import type { Env, Source } from "./types.ts";

export const sources = sourcesJson as Source[];

async function boundedText(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  let length = 0;
  const parts: Uint8Array[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 3000000) {
      await reader.cancel();
      throw new Error("来源响应超过 3 MB");
    }
    parts.push(value);
  }
  const bytes = new Uint8Array(length);
  let position = 0;
  for (const part of parts) {
    bytes.set(part, position);
    position += part.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

export async function collect(env: Env): Promise<void> {
  if (env.COLLECT_ENABLED !== "true") return;
  const stamp = Date.now();
  // Cron can overlap; D1's conditional UPSERT gives one collector a ten-minute lease.
  const lease = await env.DB.prepare(
    "INSERT INTO collection_lock (id,expires_at) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET expires_at=excluded.expires_at WHERE collection_lock.expires_at < ? RETURNING expires_at",
  )
    .bind(stamp + 600000, stamp)
    .first();
  if (!lease) return;
  try {
    const active = sources.filter((x) => x.collection !== "directory");
    for (let i = 0; i < active.length; i += 3) {
      await Promise.all(
        active.slice(i, i + 3).map(async (source) => {
          const checked = new Date().toISOString();
          try {
            const url =
              source.collection === "rss" ? source.feedUrl! : source.list!.url;
            const response = await fetch(url, {
              headers: {
                "User-Agent": "KnitFashionHOTBot/1.0",
                Accept:
                  "application/rss+xml, application/atom+xml, text/html, application/xml",
              },
              signal: AbortSignal.timeout(18000),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const text = await boundedText(response);
            const articles =
              source.collection === "rss"
                ? await parseFeed(text, source, checked)
                : await parseWeb(text, source, checked);
            if (!articles.length)
              throw new Error("本次未解析到相关条目，请核对订阅或页面结构");
            await env.DB.batch(
              articles.map((a) =>
                env.DB.prepare(
                  "INSERT INTO articles (id,source_id,url,title,summary,category,published_at,collected_at,relevance,date_kind) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET title=excluded.title,summary=excluded.summary,category=excluded.category,relevance=excluded.relevance,published_at=COALESCE(excluded.published_at,articles.published_at),date_kind=CASE WHEN excluded.published_at IS NOT NULL THEN 'published' ELSE articles.date_kind END",
                ).bind(
                  a.id,
                  a.source_id,
                  a.url,
                  a.title,
                  a.summary,
                  a.category,
                  a.published_at,
                  a.collected_at,
                  a.relevance,
                  a.date_kind,
                ),
              ),
            );
            await env.DB.prepare(
              "INSERT INTO source_runs VALUES(?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,discovered=excluded.discovered,error=excluded.error",
            )
              .bind(source.id, checked, "ok", articles.length, null)
              .run();
          } catch (error) {
            const message =
              error instanceof Error ? error.message.slice(0, 160) : "采集失败";
            console.warn("source collection", source.id, message);
            await env.DB.prepare(
              "INSERT INTO source_runs VALUES(?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,discovered=excluded.discovered,error=excluded.error",
            )
              .bind(source.id, checked, "error", 0, message)
              .run();
          }
        }),
      );
    }
  } finally {
    await env.DB.prepare(
      "DELETE FROM collection_lock WHERE id=1 AND expires_at=?",
    )
      .bind(stamp + 600000)
      .run();
  }
}
