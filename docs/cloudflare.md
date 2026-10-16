# Cloudflare 部署

针织时尚 HOT 的 Cloudflare 版位于 `modules/cloudflare/`，使用 Workers 静态资源、D1 与 Cron Triggers，无需常驻服务器。保留的 React Router / Fastify / PostgreSQL 版本按 `docs/deploy.md` 部署。两个版本使用同一信源目录，但数据分别存储，不自动同步。

当前生产地址：<https://knit-fashion-hot.534569779.workers.dev>。2026-10-16 首次发布，已创建 `knithot-db` 并将真实数据库 ID 写入配置；此账号后续更新直接执行迁移和发布，不要重复创建数据库。生产 `COLLECT_ENABLED=true`，本地默认仍关闭。

## 功能边界

| 功能 | Cloudflare 版 | PostgreSQL 原框架 |
|---|---|---|
| 全球信源目录、原文追溯 | 支持，自动采集与目录入口分别标明 | 采集源在后台维护 |
| 分类、关键词搜索、时间筛选、分页 | 支持 | 支持 |
| 本机收藏、RSS、公开 JSON | 支持 | 支持，接口路径不同 |
| 阅读简报 | 最近 24 小时、7 天、30 天索引 | 日报、周报、月报成刊 |
| 中文 AI 写作、双评分、事件聚簇、MCP、管理后台 | 本版尚未接入 | 保留，需模型密钥与服务配置 |

Cloudflare 版保留原文标题和最多 260 字符的公开摘要；关键词相关度只有 0/1/3 三档，属于索引排序，不是 AI 质量评分。没有发布日期的网页列表内容显示“收录”，不会伪装成当日新闻。不同原文 URL 独立收录，不声称完成跨媒体事件聚合。

## 本地开发

需要 Node.js 24.11 或更新版本。

```powershell
npm ci
npm run cf:dev
```

打开 `http://localhost:8787`。本地默认 `COLLECT_ENABLED=false`，自动测试只使用本地 fixture，不请求外部网站。检查：

```powershell
npm run cf:check
```

## 首次发布

1. 执行 `npx wrangler login --scopes account:read user:read workers:write workers_scripts:write d1:write`，在浏览器完成账号连接。
2. 在仓库根目录执行 `npx wrangler d1 create knithot-db`。将返回的真实 `database_id` 填入 `modules/cloudflare/wrangler.jsonc`，替换占位 UUID。多账号时设置 `CLOUDFLARE_ACCOUNT_ID`。
3. 执行 `npm run db:remote -w @knithot/cloudflare`，创建新 D1 表。本目录迁移仅适用于新建的 SQLite 数据库，与原框架 PostgreSQL 迁移分开。
4. 可选首次采集：`npm run bootstrap -w @knithot/cloudflare`。脚本直接核对公开来源，生成忽略提交的 `.data/knit-bootstrap.sql` 与核验报告。这不是自动测试，不调用模型；来源请求失败会记录原因。随后在 `modules/cloudflare` 执行 `npx wrangler d1 execute knithot-db --remote --file ../../.data/knit-bootstrap.sql` 导入真实初始资讯。
5. 执行 `npm run cf:deploy`。发布命令只在远端启用 `COLLECT_ENABLED=true`，本地配置保持关闭。Wrangler 返回实际 `workers.dev` 地址；检查首页、`/api/health`、`/api/stats`、`/feed.xml`。

部署前按真实运行方式确认隐私与使用说明（Cloudflare 前端 `public/app.js` 内相关说明；PostgreSQL 版本 `site/pages/` 有独立模板）。不要将管理密钥放入静态资源或仓库。

## 定时采集与信源

UTC 每偶数小时的第 17 分钟执行，约每两小时一次；新 Cron 配置可能需要传播时间。采集三路并发，每来源 18 秒超时，响应上限 3 MB。D1 条件写入租约防止重叠任务同时采集，同 URL 幂等更新。

`industry/source-directory.json` 是 Cloudflare 唯一信源配置。`collection: rss/web` 表示已接入解析器，`directory` 表示原站阅读入口。访问状态会变化；页面展示上次成功条数或失败原因。网页源有显式标题、日期、摘要选择器时仅在同一卡片读取；只提供日期的英文列表按该日 00:00 UTC 保存。RSS/Atom 原发布日期按订阅给出的时区解析。

失败不会覆盖已有内容。检索与阅读不触发外部采集或模型调用。全量重新采集可再次运行 bootstrap 后导入；该导入幂等且保留已有收录时间。暂时停止生产采集可在 Cloudflare 将 `COLLECT_ENABLED` 设置为 `false` 后重新部署。

## 持续部署

`.github/workflows/cloudflare.yml` 在 PR 做类型、D1 集成测试与构建；main 检查通过后发布。需要仓库 GitHub Actions 的 production 环境配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ACCOUNT_ID`，以及已填写真实 D1 ID。令牌只授予该账号 Workers Scripts Edit、D1 Edit 与发布所需的账号读取权限。不要把密钥写入文件。

## 公开接口

- `GET /api/articles?q=&category=&source=&period=day|week|month&sort=latest|relevance&limit=24&offset=0`
- `GET /api/sources`：目录和最后一次采集结果。
- `GET /api/stats`、`GET /api/categories`、`GET /api/health`
- `GET /feed.xml`：同一公开读取层生成 RSS，可带分类与检索参数。
- `GET /llms.txt`

只支持 GET/HEAD，无匿名写入或手动采集接口。搜索为 SQLite 参数化匹配；分类为 `runway/yarn/technology/market/sustainability`。RSS/接口建议至少间隔 10 分钟轮询。
