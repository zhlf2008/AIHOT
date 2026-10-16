import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalUrl,
  classify,
  parseFeed,
  parseWeb,
  textOnly,
  validDate,
} from "../src/content.ts";
import type { Source } from "../src/types.ts";

const source: Source = {
  id: "sample",
  name: "Example publisher",
  url: "https://example.com/news/",
  region: "Europe",
  language: "en",
  category: "yarn",
  tier: "official",
  description: "",
  access: "open",
  collection: "rss",
  verifiedAt: "2026-10-16",
};
const now = "2026-10-16T00:00:00.000Z";

test("RSS dates, attribution and canonical URL survive; unrelated promotions stay out", async () => {
  const items = await parseFeed(
    `<rss version="2.0"><channel><item><title>New recycled merino yarn</title><link>https://example.com/news/yarn?utm_source=x</link><description><![CDATA[<p>A circular <b>wool yarn</b>.</p><script>bad()</script>]]></description><pubDate>Thu, 15 Oct 2026 08:00:00 GMT</pubDate></item><item><title>Download our accounting software</title><link>https://example.com/software</link><description>Office tools</description></item></channel></rss>`,
    source,
    now,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://example.com/news/yarn");
  assert.equal(items[0].summary, "A circular wool yarn.");
  assert.equal(items[0].category, "sustainability");
  assert.equal(items[0].published_at, "2026-10-15T08:00:00.000Z");
  assert.equal(items[0].date_kind, "published");
});
test("Atom alternate links parse without inventing missing publication dates", async () => {
  const items = await parseFeed(
    '<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Merino wool knitting innovation</title><link rel="self" href="https://example.com/feed/one"/><link rel="alternate" href="https://example.com/news/one"/><summary>A yarn innovation</summary></entry></feed>',
    source,
    now,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].url, "https://example.com/news/one");
  assert.equal(items[0].published_at, null);
  assert.equal(items[0].date_kind, "discovered");
});
test("article URLs reject scripts, publisher changes, plain HTTP and credentials", () => {
  for (const value of [
    "javascript:alert(1)",
    "https://evil.test/a",
    "http://example.com/a",
    "https://name:secret@example.com/a",
  ])
    assert.equal(canonicalUrl(value, source.url), null);
  assert.equal(
    canonicalUrl("/news/a#title", source.url),
    "https://example.com/news/a",
  );
});
test("HTML error pages are never treated as successful subscriptions", async () => {
  await assert.rejects(
    parseFeed("<html><body>Access denied</body></html>", source),
    /RSS\/Atom/,
  );
  await assert.rejects(parseFeed("<rss><channel>", source), /XML/);
});
test("web ingestion drops navigation and duplicated links, preserves discovery date", async () => {
  const web: Source = {
    ...source,
    collection: "web",
    list: {
      url: source.url,
      linkSelector: 'a[href*="/news/"]',
      urlIncludes: "/news/",
    },
  };
  const items = await parseWeb(
    '<a href="/news/">Read more</a><a href="/news/knit">Merino wool knitting structure study</a><a href="/news/knit">Merino wool knitting structure study</a><a href="https://evil.test/news/x">External knitting headline</a>',
    web,
    now,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].published_at, null);
  assert.equal(items[0].collected_at, now);
});
test("dates and classification are explicit and do not score unverified authority", () => {
  assert.equal(validDate("wrong"), null);
  assert.equal(validDate("2030-01-01", Date.parse(now)), null);
  assert.equal(
    classify("WHOLegArment machine launch", "", "market").category,
    "technology",
  );
  assert.equal(classify("Office calendar", "", "market").relevance, 0);
  assert.equal(textOnly("<style>bad</style><b>Pure wool</b>"), "Pure wool");
});

test("configured overlay cards obtain title, excerpt and calendar date from the same item", async () => {
  const web: Source = {
    ...source,
    collection: "web",
    list: {
      url: source.url,
      linkSelector: ".item a",
      urlIncludes: "/news/",
      containerSelector: ".item",
      titleSelector: "h4",
      summarySelector: ".summary",
      dateSelector: ".date",
    },
  };
  const items = await parseWeb(
    '<div class="item"><h4>Merino wool knitting innovation</h4><div class="date">15 Oct 2026</div><div class="summary">A new wool yarn.</div><a href="/news/merino"></a></div>',
    web,
    now,
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Merino wool knitting innovation");
  assert.equal(items[0].summary, "A new wool yarn.");
  assert.equal(items[0].published_at, "2026-10-15T00:00:00.000Z");
});
