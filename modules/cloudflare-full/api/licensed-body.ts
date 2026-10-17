import { load } from "cheerio";
import rights from "../../../industry/fulltext-rights.json" with { type: "json" };

/** This deployment's reviewed text licences do not include third-party photography or embeds. */
export function licensedBody(html: string | null, sourceId: string, url: string, translated = false): string | null {
  if (!html) return html;
  const rule = (rights.sources as Record<string, { owner: string; license: string; licenseUrl: string; evidenceUrl: string; urls: string[] }>)[sourceId];
  if (!rule) return html;
  const canonical = new URL(url); canonical.search = ""; canonical.hash = "";
  if (!rule.urls.includes(canonical.href)) return null;
  const $ = load(html, null, false);
  $("figure, picture, img, video, audio, iframe, svg, canvas, object, embed").remove();
  const notice = $("<p></p>");
  notice.append($("<strong></strong>").text("正文来源与许可："));
  notice.append($("<a></a>").attr("href", canonical.href).text(rule.owner));
  notice.append(" · ");
  notice.append($("<a></a>").attr("href", rule.licenseUrl).text(rule.license));
  notice.append(" · ");
  notice.append($("<a></a>").attr("href", rule.evidenceUrl).text("来源许可说明"));
  notice.append(translated ? "。中文为本站 AI 翻译，图片与嵌入媒体已省略；请以原文为准。" : "。原文文字按许可展示，图片与嵌入媒体已省略。");
  notice.append(" 本站与来源机构无隶属或背书关系。");
  $.root().append(notice);
  // The original outline reader consumes heading text before HTML entity decoding.
  return $.html().replace(/&nbsp;/g, "\u00a0");
}
