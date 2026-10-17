import assert from "node:assert/strict";
import { test } from "node:test";
import { licensedBody } from "../api/licensed-body.ts";

const source = "web-eu-textiles";
const url = "https://environment.ec.europa.eu/news/ban-destruction-unsold-clothes-and-shoes-enters-application-2026-07-17_en";
test("reviewed full text retains words and tables, removes third-party media, and attributes its licence", () => {
  const body = '<h2>Requirements&nbsp;</h2><p>Textile rules <a href="https://example.org">evidence</a></p><table><tr><td>2030</td></tr></table><figure><img src="https://example.org/private.jpg"><figcaption>Photo</figcaption></figure><iframe src="https://example.org/video"></iframe>';
  const original = licensedBody(body, source, url)!;
  assert.ok(original.includes("Requirements") && original.includes("2030") && original.includes('href="https://example.org"'));
  assert.ok(!original.includes("private.jpg") && !original.includes("iframe"));
  assert.ok(!original.includes("&nbsp;"));
  assert.ok(original.includes("European Union / European Commission") && original.includes("https://creativecommons.org/licenses/by/4.0/"));
  assert.ok(!original.includes("中文为本站 AI 翻译"));
  assert.ok(licensedBody(body, source, url, true)!.includes("中文为本站 AI 翻译"));
});
test("a source-wide setting cannot expose an unreviewed article or a lookalike host", () => {
  assert.equal(licensedBody("<p>body</p>", source, url + "/other"), null);
  assert.equal(licensedBody("<p>body</p>", source, url.replace("environment.ec.europa.eu", "environment.ec.europa.eu.example.com")), null);
  assert.ok(licensedBody("<p>body</p>", source, url + "?utm_source=test#section"));
  assert.equal(licensedBody(null, source, url), null);
  assert.equal(licensedBody("<p>unchanged</p>", "fixture-source", "https://example.org/"), "<p>unchanged</p>");
});
