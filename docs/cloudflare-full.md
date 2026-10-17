# 原引擎 Cloudflare 适配记录

2026-10-16，使用者选择全部部署到 Cloudflare + Supabase，接受后台适配和分阶段验收。使用者开通 Workers Paid 后，手机海报与真实批处理验证通过；正式入口已切换，旧 D1 索引站及数据库快照保留以便回退。

## 正式入口

- 网页：<https://knit-fashion-hot.534569779.workers.dev/all>，使用原 React Router 页面、站内详情、中文标题与摘要、筛选、搜索、主题、浏览器本机收藏。
- 旧索引归档：<https://knit-fashion-hot-legacy.534569779.workers.dev>，保留 D1 数据，关闭自动采集。旧版 `knithot:saved` 本机收藏原值保留；两版收藏格式不同，新版不自动把旧索引 ID 当作原引擎资讯 ID。
- 公开出口：原 publication 读取层提供 `/api/site/`、`/api/v1/`、RSS、站点地图、`llms.txt`；MCP 从网页域名 `/api/mcp` 使用，保持原 Host/Origin 校验。
- API：`knit-hot-api`，通过 Web service binding 调用，数据库凭据不进入浏览器。
- 任务：`knit-hot-jobs` 的 `knithot-editorial` Workflow，复用原来源解析、采集、正文提取、预筛、双评分、中文整理、事件与发布任务。每批至多 12 个队列任务，各队列轮流获得执行机会。

真实 RSS → MiniMax → 中文整理 → publication 的单条工作流已完成，真实批处理完成来源抓取与正文提取。首次导入按原逻辑作为存量归档，未经评判的资料不会伪装成中文精选；低分资讯不强行入选。

## 数据库与连接

Supabase 免费独立项目 `knithot`（`brhzmgiklhguczhqhahn`，东京），原版 60 项迁移、46 张应用表已执行，历史 SQL 未改写。应用使用私有 `knithot` schema、独立 `knithot_app` 登录角色；`anon` / `authenticated` 没有 schema 使用权限。`pgboss` 保留持久 claim、singleton 去重、事务入队、重试和故障恢复。

Hyperdrive `a990bacb3c274caf94b482c6a6a800d0` 使用 Supabase直连，由 Hyperdrive 池化，关闭查询缓存。TLS 为 `verify-full`，配置官方 Supabase 2021 根证书，没有关闭证书校验。先前叠加 session pooler 出现等待连接超时，已切换直连并在 CF 验证成功。本机 IPv4 网络经出网代理进行数据库维护，线上不依赖本机。

## 模型、预算与定时

- MiniMax 国内兼容接口：`https://api.minimax.cn/v1`，模型 `MiniMax-M3`。采用 `thinking.type=disabled` 和 `reasoning_split=true`，真实调用验证通过。密钥仅保存在本机忽略文件与 Cloudflare Secrets。
- 使用者确认模型上限：12 次/分钟、60 次/小时、180 次/滚动 24 小时。所有模型步骤共用原回执预算；一条资料通常需要约 5–6 次调用，180 次约能处理 30 条，复杂资料与重试会占用更多次数，不保证固定条数。
- `*/10 * * * *` Cron 启动 Workflow。首个实际定时实例已于北京时间 2026-10-16 22:30 启动并完成。免费阶段直接使用 Workflow binding 的 `schedules` 被拒绝，因此采用官方支持的 Cron `scheduled` handler + binding `create()`；升级后继续使用已验证的触发路径。
- 每个定时点使用确定的实例 ID；Workflow 并发上限 1，各任务沿用原锁与回执。每批先尝试翻译一篇已经精选且允许全文的文章，再处理新采集编辑，避免普通任务挤占翻译预算。单批最多 15 个步骤（准备、翻译、12 个任务、刷新），144 批的基准上限为每日 2160 步，额外手动验证和步骤重试另计。
- 配置文件的采集/模型安全阀默认 `false`。线上部署显式传入 `--var COLLECT_ENABLED:true --var MODEL_CALLS_ENABLED:true`；普通重新部署会关阀，应按验收意图选择。推送等其他阀门保持关闭。

构建与部署（Node.js >=24.11）：

```powershell
npm run cf:full:build
npm run cf:full:deploy:media
npm run cf:full:deploy:api
npm run cf:full:deploy:web
npx wrangler deploy --config modules/cloudflare-full/jobs/wrangler.jsonc --var COLLECT_ENABLED:true --var MODEL_CALLS_ENABLED:true
npm run cf:full:deploy:production
```

新账号需替换各配置文件中的账号、Hyperdrive、KV ID 与 service binding，并设置 API、Jobs、生产 Web 一致的 `SITE_URL`；数据库迁移与 Secret 先完成。不要复制其他部署的凭据。当前原引擎的 CPU 配置为每次至多 30 秒，部署需要 Workers Paid。

`.github/workflows/cloudflare.yml` 在 PR 与 main 检查旧版测试及完整构建；正式发布仅从 main 手动触发，依次部署媒体、API、预览 Web、开启预算内任务、正式 Web，不再自动发布 D1 索引覆盖新版。Actions 需要 production 环境的 CF 令牌，Supabase 迁移与线上 Secret 需在发布前完成。本机 `npm run cf:deploy` 仅发布完整 Web 入口，完整运行时更新使用上述顺序。

## 验收边界

| 能力 | 当前状态 |
|---|---|
| 原网页、公开接口、RSS、MCP | CF 真实公开读取已验证 |
| 真实采集、正文提取、双评分、中文整理 | 单条、批处理与首个实际 Cron 实例均已验证，模型统一受 180 次/滚动 24 小时预算限制 |
| 事件归组、热点、报告 | 原处理器已接入任务，需随真实新资料继续验收；首个出刊窗口早于建站时不制造空日报 |
| 管理后台与写入 | 原密码登录、会话、CSRF、信源、内容纠错、预算和审计已接入；已在线验证登录/退出/拒绝无 CSRF 写入/信源及预算读取；联系人图片写入持久 KV，访客反馈截图未开放 |
| 图片代理、分享图、持久附件 | 私有 WASM 媒体 Worker、媒体 Workflow 和 KV 持久存储已部署；付费版线上 1200×630 中文分享图、1080×1440 手机海报、签名图片代理及缓存读取通过；海报排版已人工检查 |
| 反馈 | 按使用者确认的范围跳转 GitHub Issues，截图上传未开放 |
| 飞书、IndexNow、备份和所有运维任务 | 未声称在 CF 完整启用，相关阀门保持关闭 |
| 正式入口切换 | 已切换；正式地址的原冒烟 29 项通过，反馈 302 差异另行验证，生产 canonical、RSS 链接、MCP、后台与海报通过 |

原站隐私与使用说明依据使用者已确认的公开摘要、许可允许时的正文、Supabase/MiniMax 处理公开来源材料及 GitHub Issues 联系方式发布。针织评分门槛保留 T1=60 / T1_5=65 / T2=76，等待人工行业样本校准。日报按真实时间窗口和预算推进；周月报需要日报基础。

## 开放许可全文（2026-10-17）

已逐项核对 24 个目录来源，记录见 [全文许可核验](fulltext-rights.md)。新增两个官方采集源，自动采集配置共 13 源；原 11 源保持摘要。欧盟委员会和欧洲环境署的 4 篇登记文章开启站内文字正文，保留逐篇网址清单，不把机构许可泛化到第三方素材。公开 publication 详情和 Markdown 导出共同追加来源与 CC BY 4.0 说明，移除图片及嵌入媒体；全文 RSS 仍关闭。

真实欧盟文章 `gylrojdz5uq2u6nij3cgrgudk` 经原双评分得到 62 分，原归组为历史资料，公开精选正文；未手工抬分或修改发布时间。原翻译器完成全部 23 个段落、2 次 MiniMax 调用，`complete=true`，默认中文并支持站内原文切换。

本次预算曾经使用者同意临时从 180 增至 210。Cron 停用配置传播期间，普通任务占用了额外额度中的 25 次；单篇评判用了 5 次。已向使用者说明，另获最多 5 次翻译验收许可后，确认 Cron 停止且无在途普通实例，仅用其中 2 次完成全文。随后预算恢复 180，正常每 10 分钟 Cron 恢复，临时限制未留在线上。暂停 Cron 配置可能存在传播延迟，不把部署成功当成任务已停止；后续维护先核对实际实例。

## 回退与状态

切换前已导出旧 D1 SQL 至忽略提交的 `.data/knithot-d1-before-cutover.sql`，未删除 D1 或 Supabase 数据。旧版归档 Worker 为 `knit-fashion-hot-legacy`，版本 `14db8628-6fb4-4793-b2d9-a44eb6665a61`；切换前生产版本 `24f664f8-7162-4184-b026-1235c1681e7a`，切换后 Web 首版 `23da802a-35ff-4090-9a9d-d83894f327f9`，补齐响应式样式后版本 `c64f338a-cc5b-4b29-8ec7-f028ab9e82d2`。后续部署以 Wrangler 返回的新版本号为准。

需要恢复旧索引到正式入口时，先检查在途 Workflow，再部署 Jobs 默认关闭采集/模型阀门；显式执行 `npx wrangler deploy --config modules/cloudflare/wrangler.jsonc --var COLLECT_ENABLED:true` 恢复旧页面、D1 绑定与两小时 Cron。这个命令只用于明确回退。平常旧版发布使用 `npm run cf:legacy:deploy`，只更新归档地址且不采集。完整版本的数据库、队列和媒体资源保留，重新切回按上方完整部署顺序执行。

## 费用与官方参考

当前使用 Workers Paid、Supabase 免费项目、使用者已有 MiniMax 国内订阅。使用者明确同意并于 2026-10-16 回复已开通 Workers Paid；30 秒 CPU 配置已被 CF 接受，原失败海报恢复后成功。Workers Paid 最低每账号每月 $5，超出套餐的资源另计；模型 180 次预算只约束模型调用，不是 CF 费用上限。

**实际费用边界：** 官方限制表中，免费版 Worker/Workflow 每步 CPU 为 10ms，付费版默认 30 秒；数据库和模型网络等待不算 CPU。免费阶段手机海报重复触发 CPU 限制；升级后已恢复失败实例并在线返回 1080×1440 PNG。付费版实例 `paid-batch-20261016` 于 UTC 15:50:47–15:54:14 完成 12 个真实采集/编辑/事件任务与发布刷新，无 CPU 超限。

媒体使用独立 `knit-hot-media` Worker（不开放 workers.dev），只接受 service binding；官方 Noto 字体随静态资源发布，图片不发送给 Google Fonts。KV `4653ae3f26024c9296765d7d1eff6da4` 缓存衍生图 7 天、保存内容哈希命名的联系人图片。动画保留原始帧与时间，不做转码；AVIF 保留原图；光栅解码限定 800 万像素以控制内存。KV 是最终一致存储，首次跨地区读取可能需要传播时间。公开反馈仍走 GitHub Issues，未开放访客截图上传。

媒体 Workflow 将小结果直接作为持久输出返回，避开首次 KV 传播延迟；大结果存 KV，内部 HTTP 最多等待 50 秒后返回可重试的 503。输入暂存最长 1 小时。尚未验证的重渲染不得标作稳定上线；失败实例需核查并通过受认证的管理工具恢复。

[Workflow 触发方式](https://developers.cloudflare.com/workflows/build/trigger-workflows/)、[Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/)、[Hyperdrive + Supabase](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/)、[Workers 价格](https://developers.cloudflare.com/workers/platform/pricing/)、[Workflows 价格](https://developers.cloudflare.com/workflows/reference/pricing/)、[MiniMax 国内兼容接口](https://platform.minimax.cn/docs/api-reference/text-openai-api)。
