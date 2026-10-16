# 针织服装潮流信源核验记录

核验日期：2026-10-16。`industry/source-directory.json` 收录 22 个全球来源；`industry/sources.json` 配置 7 个 RSS 与 4 个官方网页列表，共 11 个采集源，全部 `site_fulltext` 和 `syndicate_fulltext` 为 `false`。初版索引采集曾解析全部 11 源；原引擎及 CF 批处理复核为 10 源成功、Textile World 超时，不能把配置接入或单次成功当成长久可用。

## 已验证、可直接采集

| 来源 | 地址 | HTTP / XML 检查 | 侧重点 |
|---|---|---|---|
| Cotton Incorporated | https://www.cottoninc.com/feed/ | 200，RSS，99 个 `<item>` | 棉纤维、研究、市场 |
| Fibre2Fashion | https://feeds.feedburner.com/fibre2fashion/textile-news | 200，XML，10 个 `<item>` | 全球纺织、服装市场 |
| TheIndustry.fashion | https://theindustry.fashion/feed/ | 200，RSS，20 个 `<item>` | 欧洲与全球时尚商业 |
| Textilegence | https://www.textilegence.com/en/feed/ | 200，RSS，15 个 `<item>` | 纺织数字化与技术 |
| Textile World | https://www.textileworld.com/feed/ | 初次 200；原引擎及 CF 复核超时，保留失败记录和重试 | 纤维、设备、制造 |
| Knitting Industry | https://www.knittingindustry.com/feed/ | 200，RSS，9 个 `<item>` | 针织设备、纱线、工厂 |
| Knitting Trade Journal | https://www.knittingtradejournal.com/feed/ | 200，RSS，10 个 `<item>` | 工业针织与生产技术 |

初版 D1 索引的 RSS 使用 `fast-xml-parser` 严格校验并筛选针织相关性，保留来源标题摘要。原引擎版本使用其原有 `fetchRss` / `parseFeed`，再通过真实 MiniMax 预筛、双评分和中文整理发布；首次导入按存量归档，不刷成今日新闻。公开层仅展示许可范围内的摘要和原文链接。Fibre2Fashion 使用 FeedBurner，保留来源名和原始链接。

## 已验证网页列表

以下网页列表已用原框架 `fromHtml`（Cheerio）读取真实 HTML，并命中有文字标题的文章链接：Pitti Filati 使用文章链接自身作为条目，命中 6 条；Woolmark 使用 `.articleListItem-content` 条目、`.articleListItem-linkOverlay` 链接和 `.articleListItem-title` 标题，命中 8 条；Première Vision 使用 `article.itemcontent`、`a.card-cliquable[href*='/en/articles/']` 与 `h3.title`，命中 1 条当前可公开文章；Pantone 使用 `article`、`a.mb-1[href*='/articles/color-of-the-year/']`，命中 3 条季节色彩文章。`titleSelector` 读取同一卡片中的标题节点，避免把图片 overlay 当成文章标题。

## 目录与后续网页采集

SPINEXPO、SHIMA SEIKI、STOLL、Textile Exchange、FashionUnited、WWD、Vogue Runway、The Business of Fashion、Lenzing 和 The SPIN OFF 以 `collection: directory` 记录，代表人工/外部采集目录，不假称自动采集。Pitti Filati、Woolmark、Première Vision、Pantone 已完成真实 HTML 链接选择器核验。

本次 HTTP 结果：Pitti Filati 新官方入口、Woolmark newsroom、SPINEXPO、WWD、Vogue Runway、Pantone、Lenzing、FashionUnited 和 The SPIN OFF 返回 200；Première Vision 旧分类页返回 404，已切换到官方 `/en/content/magazine`；Textile Exchange `/news/` 对当前自动请求返回 403，SHIMA SEIKI 与 STOLL 在当前网络环境分别出现 TLS/路径问题，Business of Fashion 返回 403。Apparel Resources 返回内容无法通过严格 XML 校验，已从自动 RSS 清单移入目录来源。它们保留在目录中，供人工核对官方新路径或外部推送接入。

网页列表配置应遵守 `docs/sources.md`：`itemSelector` 必须选中重复的新闻条目，`linkSelector` 在条目内取文章链接，`allowUrlPrefixes`/`urlIncludes` 只允许文章路径；若原始 HTTP 没有文章节点，浏览器可见的内容不能靠 CSS 选择器补出，应使用 RSS、Jina 或外部采集器。

## 分类与使用建议

目录分类仅使用 `runway`、`yarn`、`technology`、`market`、`sustainability` 五个枚举。官方机构/展会设为 `official`，行业媒体设为 `editorial`；`access: subscription` 或 `mixed` 的来源只保留标题、摘要和链接，不绕过付费墙。欧洲来源覆盖 Pitti Filati、Première Vision、Lenzing、STOLL、FashionUnited；亚洲来源覆盖 SPINEXPO、SHIMA SEIKI、Fibre2Fashion、Apparel Resources；北美/大洋洲来源覆盖 WWD、Vogue Runway、Pantone、Cotton Incorporated、Textile Exchange、Woolmark。The SPIN OFF 使用已核验的 `https://www.the-spin-off.com/`，是当代时尚专业媒体，不是手工纺纱杂志。


## Cloudflare 集成实测补充

使用实际原框架 `fromHtml` / `fetchWebList` 与 `parseFeed` 生成初始数据库，收录短摘要与原文链接。Woolmark 的标题与空 overlay 链接属于同一 `.articleListItem-content` 卡片，已增加显式卡片、标题、摘要与日期选择器并接入；英文日历日期以 UTC 当日 00:00 记录。RSS 的独立媒体来源保持原文署名。Vogue Runway、FashionUnited、Apparel Resources 等保留为原站阅读入口，不用导航链接冒充新闻。最新运行结果以页面信源状态为准；网络可访问性不代表长期更新保证。
