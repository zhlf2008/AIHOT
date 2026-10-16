# 针织时尚 HOT 验证记录

日期：2026-10-16。运行环境为 Windows，检查使用 Node.js 24.21.0。

## 已通过

- 全仓 `npm run typecheck`。
- 原框架 Web 生产构建 `npm run build -w @aihot/web`。
- 独立后端测试 `npm run test:standalone`：183 项通过。测试使用本地 fixture；Windows 需将 Git 自带 OpenSSL 的目录加入当前进程 PATH。
- Cloudflare `npm run cf:check`：类型检查、8 项解析/D1/API 集成测试、Workers 发布包试构建通过。D1 集成测试还覆盖参数化搜索、RSS 转义、缺失日期、匿名写入拒绝、采集开关、失败记录、重复采集幂等与重叠任务租约。
- 本地 Cloudflare Worker 与 D1 真实迁移、初始化导入、健康检查、分类、搜索、RSS 读取。
- 浏览器检查：桌面与手机布局、收藏与取消收藏、全球信源目录、自动采集来源筛选、关键词检索。
- 真实信源单次集成采集：22 个目录来源中的 11 个采集配置成功解析，共 94 条相关内容（7 个 RSS、4 个网页列表）。这些是实际公开资讯，不是展示用虚构新闻。原始核验报告与导入数据保留在本机忽略提交的 `.data/`。

## 验证范围与待完成项

- 原框架的 Web 浏览器测试 56 项中 52 项通过、4 项失败：WebKit 视频导航超时，以及 navigation-performance 中的正文/返回锚点相关检查。此次没有为通过测试而降低这些断言；这些路径不属于 Cloudflare 新前端。
- 全量 PostgreSQL `npm test` 需要一个名字以 `_test` 或 `_ci` 结尾的临时数据库。本机未配置 `DATABASE_URL`，测试在保护检查处停止；尚未完成该数据库测试组。
- 原框架 `scripts/smoke.ts` 依赖其 Fastify/PostgreSQL 服务，尚未运行。Cloudflare 版本使用单独的 D1/API 集成测试与浏览器验收。
- 初始评分门槛保留上游值，需使用针织行业人工样本校准。
- 2026-10-16 已完成 Cloudflare 生产发布：<https://knit-fashion-hot.534569779.workers.dev>。版本 ID 为 `24f664f8-7162-4184-b026-1235c1681e7a`。线上首页、数据库健康检查、统计、merino 关键词检索与 RSS 均返回 200；统计显示 94 条资讯、22 个信源入口、11 个采集源、生产采集已启用。Cron 已配置 `17 */2 * * *`，尚未等到首次生产定时执行，不将配置成功等同于未来每次抓取成功。
- 用户已确认 Cloudflare 版本的匿名浏览、本机收藏、公开摘要与原文链接、基础网络日志及 GitHub Issues 联系说明后发布。
