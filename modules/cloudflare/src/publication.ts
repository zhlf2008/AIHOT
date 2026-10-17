import { sources } from "./collect.ts";
import type { Article, Env } from "./types.ts";
import { CATEGORIES } from "./content.ts";

// Every public outlet uses this read layer: JSON, RSS and daily/weekly/monthly reading lists.
export async function readArticles(env: Env, url: URL) {
  const clauses: string[] = [];
  const values: (string | number)[] = [];
  const q = url.searchParams.get("q")?.trim().slice(0, 100);
  const category = url.searchParams.get("category");
  const source = url.searchParams.get("source");
  if (q) {
    clauses.push("(title LIKE ? ESCAPE '\\' OR summary LIKE ? ESCAPE '\\')");
    const escaped = q.replace(/[\\%_]/g, "\\$&");
    values.push(`%${escaped}%`, `%${escaped}%`);
  }
  if (category && Object.hasOwn(CATEGORIES, category)) {
    clauses.push("category=?");
    values.push(category);
  }
  if (source && sources.some((x) => x.id === source)) {
    clauses.push("source_id=?");
    values.push(source);
  }
  const days =
    url.searchParams.get("period") === "week"
      ? 7
      : url.searchParams.get("period") === "month"
        ? 30
        : url.searchParams.get("period") === "day"
          ? 1
          : 0;
  if (days) {
    clauses.push("COALESCE(published_at,collected_at)>=?");
    values.push(new Date(Date.now() - days * 86400000).toISOString());
  }
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const rawLimit = Number(url.searchParams.get("limit") || 24);
  const rawOffset = Number(url.searchParams.get("offset") || 0);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(100, Math.trunc(rawLimit)))
    : 24;
  const offset = Number.isFinite(rawOffset)
    ? Math.max(0, Math.min(10000, Math.trunc(rawOffset)))
    : 0;
  const selected = url.searchParams.get("sort") === "relevance";
  const [rows, count] = await Promise.all([
    env.DB.prepare(
      `SELECT * FROM articles ${where} ORDER BY ${selected ? "relevance DESC," : ""} COALESCE(published_at,collected_at) DESC,id ASC LIMIT ? OFFSET ?`,
    )
      .bind(...values, limit, offset)
      .all<Article>(),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM articles ${where}`)
      .bind(...values)
      .first<{ total: number }>(),
  ]);
  return {
    items: rows.results.map((a) => ({
      ...a,
      source: sources.find((s) => s.id === a.source_id)?.name ?? a.source_id,
    })),
    total: count?.total ?? 0,
    limit,
    offset,
  };
}

export async function readSources(env: Env) {
  const results = await env.DB.prepare(
    "SELECT source_id, checked_at,status,discovered,error FROM source_runs",
  ).all();
  return sources.map((source) => ({
    ...source,
    run: results.results.find((r: any) => r.source_id === source.id) ?? null,
  }));
}

export async function readStats(env: Env) {
  const [total, recent, last, byCategory, active] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS n FROM articles").first<{ n: number }>(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM articles WHERE collected_at>=?")
      .bind(new Date(Date.now() - 86400000).toISOString())
      .first<{ n: number }>(),
    env.DB.prepare("SELECT MAX(checked_at) AS at FROM source_runs").first<{
      at: string | null;
    }>(),
    env.DB.prepare(
      "SELECT category,COUNT(*) AS count FROM articles GROUP BY category",
    ).all(),
    env.DB.prepare(
      "SELECT COUNT(*) AS n FROM source_runs WHERE status='ok'",
    ).first<{ n: number }>(),
  ]);
  return {
    total: total?.n ?? 0,
    collectedToday: recent?.n ?? 0,
    lastChecked: last?.at ?? null,
    categories: byCategory.results,
    sourceCount: sources.length,
    automaticSources: sources.filter((s) => s.collection !== "directory")
      .length,
    healthySources: active?.n ?? 0,
    collectionEnabled: env.COLLECT_ENABLED === "true",
  };
}

export function xmlEscape(value: string) {
  return value.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
}

export async function readRss(env: Env, url: URL) {
  const { items } = await readArticles(env, url);
  const base = url.origin;
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>针织时尚 HOT</title><link>${base}</link><description>全球针织服装潮流与产业资讯，摘要及原文链接</description><language>zh-CN</language>${items.map((a) => `<item><guid isPermaLink="false">${a.id}</guid><title>${xmlEscape(a.title)}</title><link>${xmlEscape(a.url)}</link><description>${xmlEscape(a.summary)}</description><source url="${xmlEscape(sources.find((s) => s.id === a.source_id)?.url ?? a.url)}">${xmlEscape(a.source)}</source>${a.published_at ? `<pubDate>${new Date(a.published_at).toUTCString()}</pubDate>` : ""}</item>`).join("")}</channel></rss>`;
}
