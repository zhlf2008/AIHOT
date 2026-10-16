# 原引擎 Cloudflare 适配记录

2026-10-16，使用者选择全部部署到 Cloudflare + Supabase，接受后台适配和分阶段验收。现有 D1 索引站继续运行，原引擎预览尚未切换到旧站地址。

## 可访问的预览

- 网页：<https://knit-hot-web.534569779.workers.dev/all>，使用原 React Router 页面、站内详情、中文标题与摘要、筛选、搜索、主题、浏览器本机收藏。
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
- `*/10 * * * *` Cron 启动 Workflow。首个实际定时实例已于北京时间 2026-10-16 22:30 启动并完成。直接使用 Workflow binding 的 `schedules` 被 CF 明确拒绝（要求付费），因此使用官方支持的 Cron `scheduled` handler + binding `create()`。未开通付费套餐。
- 每个定时点使用确定的实例 ID；Workflow 并发上限 1，各任务沿用原锁与回执。单批最多 14 个步骤（准备、12 个任务、刷新），144 批的基准上限为每日 2016 步，额外手动验证和步骤重试另计。
- 配置文件的采集/模型安全阀默认 `false`。线上部署显式传入 `--var COLLECT_ENABLED:true --var MODEL_CALLS_ENABLED:true`；普通重新部署会关阀，应按验收意图选择。推送等其他阀门保持关闭。

构建与部署（Node.js >=24.11）：

```powershell
npm run cf:full:build
npm run cf:full:deploy:media
npm run cf:full:deploy:api
npm run cf:full:deploy:web
npx wrangler deploy --config modules/cloudflare-full/jobs/wrangler.jsonc --var COLLECT_ENABLED:true --var MODEL_CALLS_ENABLED:true
```

新账号需替换三个配置文件中的账号、Hyperdrive ID 与 service binding；数据库迁移与 Secret 先完成。不要复制其他部署的凭据。

## 验收边界

| 能力 | 当前状态 |
|---|---|
| 原网页、公开接口、RSS、MCP | CF 真实公开读取已验证 |
| 真实采集、正文提取、双评分、中文整理 | 单条、批处理与首个实际 Cron 实例均已验证，模型统一受 180 次/滚动 24 小时预算限制 |
| 事件归组、热点、报告 | 原处理器已接入任务，需随真实新资料继续验收；首个出刊窗口早于建站时不制造空日报 |
| 管理后台与写入 | 原密码登录、会话、CSRF、信源、内容纠错、预算和审计已接入；已在线验证登录/退出/拒绝无 CSRF 写入/信源及预算读取；联系人图片写入持久 KV，访客反馈截图未开放 |
| 图片代理、分享图、持久附件 | 已增加私有 WASM 媒体 Worker、媒体 Workflow 和 KV 持久存储；线上 1200×630 中文分享图、签名图片代理及缓存读取通过；1080×1440 手机海报在免费版仍触发 CPU 限制 |
| 反馈 | 按使用者确认的范围跳转 GitHub Issues，截图上传未开放 |
| 飞书、IndexNow、备份和所有运维任务 | 未声称在 CF 完整启用，相关阀门保持关闭 |
| 正式入口切换 | 完整链路验收后进行，保留旧版回退 |

原站隐私与使用说明已根据公开摘要、Supabase/MiniMax 处理公开来源材料及 GitHub Issues 联系方式更新；正式切换前仍核对实际开放功能。针织评分门槛保留 T1=60 / T1_5=65 / T2=76，等待人工行业样本校准。

## 费用与官方参考

当前使用免费 Workers/Workflows、Supabase 免费项目、使用者已有 MiniMax 订阅。没有开通新的 CF 付费计划，免费额度不代表无限资源。Workers Paid 最低每账号每月 $5，是否升级由使用者另行决定。

**实际费用边界：** 官方限制表中，免费版 Worker/Workflow 每步 CPU 为 10ms，付费版默认 30 秒；数据库和模型网络等待不算 CPU。实际采集、编辑和普通分享图通过，不代表较重工作稳定在免费限制内：手机海报已在普通请求和媒体 Workflow 中重复出现 `Worker exceeded CPU time limit`。完整版本建议 Workers Paid，再继续验证海报和重任务；没有替使用者开通套餐。

媒体使用独立 `knit-hot-media` Worker（不开放 workers.dev），只接受 service binding；官方 Noto 字体随静态资源发布，图片不发送给 Google Fonts。KV `4653ae3f26024c9296765d7d1eff6da4` 缓存衍生图 7 天、保存内容哈希命名的联系人图片。动画保留原始帧与时间，不做转码；AVIF 保留原图；光栅解码限定 800 万像素以控制内存。KV 是最终一致存储，首次跨地区读取可能需要传播时间。公开反馈仍走 GitHub Issues，未开放访客截图上传。

媒体 Workflow 将小结果直接作为持久输出返回，避开首次 KV 传播延迟；大结果存 KV，内部 HTTP 最多等待 50 秒后返回可重试的 503。输入暂存最长 1 小时。尚未验证的重渲染不得标作稳定上线；失败实例需核查并通过受认证的管理工具恢复。

[Workflow 触发方式](https://developers.cloudflare.com/workflows/build/trigger-workflows/)、[Cron](https://developers.cloudflare.com/workers/configuration/cron-triggers/)、[Hyperdrive + Supabase](https://developers.cloudflare.com/hyperdrive/examples/connect-to-postgres/postgres-database-providers/supabase/)、[Workers 价格](https://developers.cloudflare.com/workers/platform/pricing/)、[Workflows 价格](https://developers.cloudflare.com/workflows/reference/pricing/)、[MiniMax 国内兼容接口](https://platform.minimax.cn/docs/api-reference/text-openai-api)。
