// Explicit one-time public-source capture for initial D1 import. Automated tests never call this.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { ProxyAgent, fetch as proxyFetch } from "undici";
import sourcesJson from "../../../industry/source-directory.json" with { type: "json" };
import { parseFeed, parseWeb } from "../src/content.ts";
import type { Article, Source } from "../src/types.ts";

const root = resolve(import.meta.dirname, "../../..");
const output = resolve(root, ".data/knit-bootstrap.sql");
const quote = (value: string | number | null): string =>
  value === null
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : `'${value.replace(/'/g, "''")}'`;
const sql: string[] = [];
const articles = new Map<string, Article>();
const report: Record<string, unknown>[] = [];
const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const dispatcher = proxy ? new ProxyAgent(proxy) : undefined;
for (const source of sourcesJson as Source[]) {
  if (source.collection === "directory") continue;
  const now = new Date().toISOString();
  try {
    const response = await proxyFetch(source.feedUrl || source.list!.url, {
      dispatcher,
      signal: AbortSignal.timeout(25000),
      headers: {
        "User-Agent": "KnitFashionHOTBot/1.0",
        Accept:
          "application/rss+xml, application/atom+xml, text/html, application/xml",
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.text();
    if (data.length > 3000000) throw new Error("响应超过 3 MB");
    const parsed =
      source.collection === "rss"
        ? await parseFeed(data, source, now)
        : await parseWeb(data, source, now);
    if (!parsed.length) throw new Error("未找到相关条目");
    parsed.forEach((a) => articles.set(a.url, a));
    report.push({
      source: source.id,
      status: "ok",
      articles: parsed.length,
      sample: parsed[0].title,
    });
    sql.push(
      `INSERT INTO source_runs VALUES(${[source.id, now, "ok", parsed.length, null].map(quote).join(",")}) ON CONFLICT(source_id) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,discovered=excluded.discovered,error=excluded.error;`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    report.push({ source: source.id, status: "error", error: message });
    sql.push(
      `INSERT INTO source_runs VALUES(${[source.id, now, "error", 0, message].map(quote).join(",")}) ON CONFLICT(source_id) DO UPDATE SET checked_at=excluded.checked_at,status=excluded.status,discovered=excluded.discovered,error=excluded.error;`,
    );
  }
}
for (const a of articles.values())
  sql.push(
    `INSERT INTO articles(id,source_id,url,title,summary,category,published_at,collected_at,relevance,date_kind) VALUES(${[a.id, a.source_id, a.url, a.title, a.summary, a.category, a.published_at, a.collected_at, a.relevance, a.date_kind].map(quote).join(",")}) ON CONFLICT(url) DO UPDATE SET title=excluded.title,summary=excluded.summary,category=excluded.category,relevance=excluded.relevance,published_at=COALESCE(excluded.published_at,articles.published_at),date_kind=CASE WHEN excluded.published_at IS NOT NULL THEN 'published' ELSE articles.date_kind END;`,
  );
await mkdir(resolve(root, ".data"), { recursive: true });
await writeFile(output, sql.join("\n") + "\n");
await writeFile(
  resolve(root, ".data/knit-source-report.json"),
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({ articles: articles.size, report, output }, null, 2),
);
await dispatcher?.close();
