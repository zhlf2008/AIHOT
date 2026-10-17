import { load } from "cheerio/slim";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import type { Article, Category, Source } from "./types.ts";

export const CATEGORIES: Record<Category, string> = {
  runway: "秀场与趋势",
  yarn: "纱线与色彩",
  technology: "针织与工艺",
  market: "品牌与市场",
  sustainability: "可持续材料",
};

export function textOnly(value: unknown, max = 280): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const $ = load(`<div>${String(value)}</div>`);
  $("script,style,noscript").remove();
  return $.text().replace(/\s+/g, " ").trim().slice(0, max);
}

export function canonicalUrl(value: string, base: string): string | null {
  try {
    const url = new URL(value, base);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    // Article URLs stay on the publisher's domain (including www redirects).
    const host = (v: string) => v.replace(/^www\./, "");
    if (host(url.hostname) !== host(new URL(base).hostname)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_)/i.test(key)) url.searchParams.delete(key);
    }
    return url.href;
  } catch {
    return null;
  }
}

export function validDate(value: unknown, now = Date.now()): string | null {
  if (typeof value !== "string") return null;
  const date = Date.parse(value);
  // Never turn a broken or missing publication date into today's news.
  return Number.isFinite(date) &&
    date <= now + 86400000 &&
    date > Date.UTC(2000, 0, 1)
    ? new Date(date).toISOString()
    : null;
}

export function classify(
  title: string,
  summary: string,
  fallback: Category,
): { category: Category; relevance: number } {
  const text = `${title} ${summary}`.toLowerCase();
  const knitting =
    /\b(knit\w*|yarns?|wool\w*|cashmere|merino|crochet|hosiery|sweaters?|jersey|stoll|shima|pitti|fibres?|fibers?|tencel|lenzing)\b|针织|纱线|羊毛|羊绒|毛衫|编织|纤维/.test(
      text,
    );
  const material = /textile|fabric|apparel|fashion|服装|时装|纺织/.test(text);
  let category = fallback;
  if (
    /recycl|circular|sustainab|regenerat|emissions|traceab|再生|循环|可持续|认证/.test(
      text,
    )
  )
    category = "sustainability";
  else if (
    /flat.?knit|wholegarment|machiner|stoll|shima|seamless|3d.?knit|横机|工艺|无缝/.test(
      text,
    )
  )
    category = "technology";
  else if (
    /\byarns?\b|fibres?|fibers?|wool|cashmere|cotton|color|colour|纱线|纤维|色彩/.test(
      text,
    )
  )
    category = "yarn";
  else if (/runway|fashion week|collection|trend|秀场|时装周|廓形/.test(text))
    category = "runway";
  return { category, relevance: knitting ? 3 : material ? 1 : 0 };
}

const list = (value: any): any[] =>
  value == null ? [] : Array.isArray(value) ? value : [value];
const rawText = (value: any): string =>
  typeof value === "object"
    ? String(value?.["#text"] ?? "")
    : String(value ?? "");

export async function articleId(url: string): Promise<string> {
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(url),
  );
  return [...new Uint8Array(hash)]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
}

export async function parseFeed(
  xml: string,
  source: Source,
  now = new Date().toISOString(),
): Promise<Article[]> {
  if (XMLValidator.validate(xml) !== true)
    throw new Error("来源未返回有效 XML");
  const parsed = new XMLParser({
    ignoreAttributes: false,
    processEntities: true,
    htmlEntities: true,
    parseTagValue: false,
  }).parse(xml);
  if (!parsed.rss?.channel && !parsed.feed && !parsed["rdf:RDF"])
    throw new Error("来源未返回 RSS/Atom");
  const items = list(
    parsed.rss?.channel?.item ?? parsed.feed?.entry ?? parsed["rdf:RDF"]?.item,
  ).slice(0, 60);
  const results: Article[] = [];
  for (const item of items) {
    const title = textOnly(rawText(item.title), 240);
    const link = list(item.link).find(
      (x: any) =>
        typeof x === "string" || !x["@_rel"] || x["@_rel"] === "alternate",
    );
    const url = canonicalUrl(
      typeof link === "object" ? link["@_href"] : rawText(link),
      source.url,
    );
    if (!url || title.length < 8) continue;
    const summary = textOnly(
      rawText(
        item.description ??
          item.summary ??
          item["content:encoded"] ??
          item.content,
      ),
      260,
    );
    const classification = classify(title, summary, source.category);
    if (!classification.relevance) continue;
    const published = validDate(
      rawText(
        item.pubDate ?? item.published ?? item.updated ?? item["dc:date"],
      ),
      Date.parse(now),
    );
    results.push({
      id: await articleId(url),
      source_id: source.id,
      url,
      title,
      summary,
      ...classification,
      published_at: published,
      collected_at: now,
      date_kind: published ? "published" : "discovered",
    });
  }
  return results;
}

export async function parseWeb(
  html: string,
  source: Source,
  now = new Date().toISOString(),
): Promise<Article[]> {
  if (!source.list) return [];
  const $ = load(html);
  const seen = new Set<string>();
  const candidates: {
    title: string;
    url: string;
    summary: string;
    date: string | null;
  }[] = [];
  $(source.list.linkSelector).each((_, element) => {
    const a = $(element);
    const url = canonicalUrl(a.attr("href") ?? "", source.url);
    if (
      !url ||
      !new URL(url).pathname.includes(source.list!.urlIncludes) ||
      seen.has(url)
    )
      return;
    const pagePath = new URL(source.list!.url).pathname.replace(/\/$/, "");
    if (new URL(url).pathname.replace(/\/$/, "") === pagePath) return;
    const context = a.closest(
      source.list!.containerSelector || "article,li,.news-item,.card",
    );
    const title = textOnly(
      (source.list!.titleSelector
        ? context.find(source.list!.titleSelector).first().text()
        : "") ||
        a.attr("title") ||
        a.find("h2,h3,h4").first().text() ||
        a.text(),
      240,
    );
    if (
      title.length < 18 ||
      /^(read more|load more|next|previous|view all|newsroom|news|subscribe|sign in|log in)/i.test(
        title,
      )
    )
      return;
    seen.add(url);
    const time = context.find("time").first();
    const dateText = source.list!.dateSelector
      ? textOnly(context.find(source.list!.dateSelector).first().text(), 60)
      : "";
    // An English calendar date without a time is stored at 00:00 UTC, independently of the host timezone.
    const calendarDate = /^\d{1,2} [A-Za-z]{3,9} \d{4}$/.test(dateText)
      ? `${dateText} 00:00:00 GMT`
      : undefined;
    const summary = source.list!.summarySelector
      ? textOnly(context.find(source.list!.summarySelector).first().text(), 260)
      : "";
    candidates.push({
      title,
      url,
      summary,
      date: validDate(time.attr("datetime") || calendarDate, Date.parse(now)),
    });
  });
  const results: Article[] = [];
  for (const item of candidates.slice(0, 16)) {
    const classification = classify(item.title, item.summary, source.category);
    if (
      !classification.relevance &&
      !["yarn", "technology", "sustainability"].includes(source.category)
    )
      continue;
    results.push({
      id: await articleId(item.url),
      source_id: source.id,
      url: item.url,
      title: item.title,
      summary: item.summary,
      ...classification,
      relevance: Math.max(1, classification.relevance),
      published_at: item.date,
      collected_at: now,
      date_kind: item.date ? "published" : "discovered",
    });
  }
  return results;
}
