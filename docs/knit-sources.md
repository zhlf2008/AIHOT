# 针织服装潮流信源核验记录

核验日期：2026-10-16。`industry/source-directory.json` 收录 22 个全球来源；其中 `collection: rss` 的 7 个来源已通过主代理 XML 校验与内容筛选。`industry/sources.json` 只放这 7 个可直接采集源，全部 `site_fulltext` 和 `syndicate_fulltext` 为 `false`。

## 已验证、可直接采集

| 来源 | 地址 | HTTP / XML 检查 | 侧重点 |
|---|---|---|---|
| Cotton Incorporated | https://www.cottoninc.com/feed/ | 200，RSS，99 个 `<item>` | 棉纤维、研究、市场 |
| Fibre2Fashion | https://feeds.feedburner.com/fibre2fashion/textile-news | 200，XML，10 个 `<item>` | 全球纺织、服装市场 |
| TheIndustry.fashion | https://theindustry.fashion/feed/ | 200，RSS，20 个 `<item>` | 欧洲与全球时尚商业 |
| Textilegence | https://www.textilegence.com/en/feed/ | 200，RSS，15 个 `<item>` | 纺织数字化与技术 |
| Textile World | https://www.textileworld.com/feed/ | 200，RSS，10 个 `<item>` | 纤维、设备、制造 |
| Knitting Industry | https://www.knittingindustry.com/feed/ | 200，RSS，9 个 `<item>` | 针织设备、纱线、工厂 |
| Knitting Trade Journal | https://www.knittingtradejournal.com/feed/ | 200，RSS，10 个 `<item>` | 工业针织与生产技术 |

这些 RSS 已通过主代理 `fast-xml-parser` 的严格 XML 校验和针织相关性筛选。建议首次导入只取最近 8 条；摘要和标题保留原文，公开层只展示摘要与原文链接。Fibre2Fashion 的 RSS 使用 FeedBurner，页面明确要求仅用于 RSS 展示并保留原始署名，发布时应保留来源名和原文链接。

## 已验证网页列表

以下网页列表已用 Cheerio 读取真实 HTML，并由主代理解析器命中有文字标题的文章链接：Pitti Filati 使用 `a[href*="/en/pittimmagine/archive/"][href*="/news/"]`，命中 3 条；Première Vision 使用 `https://www.premierevision.com/en/content/magazine` 与 `a[href*="/en/articles/"]`，命中 8 条；Pantone 使用 `a[href*="/articles/color-of-the-year/"]`，按 `yarn` 类别通过相关性筛选。Woolmark 的链接是空 overlay、标题在相邻 `h4`，当前解析器无法从该 `<a>` 得到标题；FashionUnited 和 Vogue 的主要链接是图片卡片/设计师导航，也无法稳定提取文字标题，因此均已降级为 `directory`。

## 目录与后续网页采集

SPINEXPO、Woolmark、SHIMA SEIKI、STOLL、Textile Exchange、FashionUnited、WWD、Vogue Runway、The Business of Fashion、Lenzing 和 The SPIN OFF 以 `collection: directory` 记录，代表人工/外部采集目录，不假称自动采集。Pitti Filati、Première Vision、Pantone 已完成真实 HTML 链接选择器核验。

本次 HTTP 结果：Pitti Filati 新官方入口、Woolmark newsroom、SPINEXPO、WWD、Vogue Runway、Pantone、Lenzing、FashionUnited 和 The SPIN OFF 返回 200；Première Vision 旧分类页返回 404，已切换到官方 `/en/content/magazine`；Textile Exchange `/news/` 对当前自动请求返回 403，SHIMA SEIKI 与 STOLL 在当前网络环境分别出现 TLS/路径问题，Business of Fashion 返回 403。Apparel Resources 返回内容无法通过严格 XML 校验，已从自动 RSS 清单移入目录来源。它们保留在目录中，供人工核对官方新路径或外部推送接入。

网页列表配置应遵守 `docs/sources.md`：`itemSelector` 必须选中重复的新闻条目，`linkSelector` 在条目内取文章链接，`allowUrlPrefixes`/`urlIncludes` 只允许文章路径；若原始 HTTP 没有文章节点，浏览器可见的内容不能靠 CSS 选择器补出，应使用 RSS、Jina 或外部采集器。

## 分类与使用建议

目录分类仅使用 `runway`、`yarn`、`technology`、`market`、`sustainability` 五个枚举。官方机构/展会设为 `official`，行业媒体设为 `editorial`；`access: subscription` 或 `mixed` 的来源只保留标题、摘要和链接，不绕过付费墙。欧洲来源覆盖 Pitti Filati、Première Vision、Lenzing、STOLL、FashionUnited；亚洲来源覆盖 SPINEXPO、SHIMA SEIKI、Fibre2Fashion、Apparel Resources；北美/大洋洲来源覆盖 WWD、Vogue Runway、Pantone、Cotton Incorporated、Textile Exchange、Woolmark。The SPIN OFF 使用已核验的 `https://www.the-spin-off.com/`，是当代时尚专业媒体，不是手工纺纱杂志。


## Cloudflare 集成实测补充

使用实际 `parseFeed` / `parseWeb` 生成初始数据库，收录短摘要与原文链接。Woolmark 的标题与空 overlay 链接属于同一 `.articleListItem-content` 卡片，已增加显式卡片、标题、摘要与日期选择器并重新接入；英文日历日期以 UTC 当日 00:00 记录。RSS 的独立媒体来源保持原文署名。Vogue Runway、FashionUnited、Apparel Resources 等保留为原站阅读入口，不用导航链接冒充新闻。最新运行结果以页面信源状态为准；网络可访问性不代表长期更新保证。
