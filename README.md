# 针织时尚 HOT

**从一根纱，看见下一季。** 面向针织服装设计师、买手与研发团队的全球趋势及产业资讯项目，基于 [AIHOT](https://github.com/KKKKhazix/AIHOT) 开源框架改造。

**在线访问：[针织时尚 HOT](https://knit-fashion-hot.534569779.workers.dev)** · [RSS 订阅](https://knit-fashion-hot.534569779.workers.dev/feed.xml)

**[查看中文动态](https://knit-fashion-hot.534569779.workers.dev/all)**。正式入口已切换到 Workers + Workflows + Supabase 原引擎适配版，支持站内详情、中文整理、主题、搜索、收藏、后台、RSS、API、MCP 与手机分享海报。Workers Paid 已由使用者开通，最低 $5/月；所有模型步骤合计最多 180 次/滚动 24 小时。日报等待建站后的首个真实出刊窗口，不强行制造精选。[部署与验收记录](docs/cloudflare-full.md)。

关注五条主线：**秀场与趋势、纱线与色彩、针织与工艺、品牌与市场、可持续材料**。

## Cloudflare 完整版本

使用 Workers 承载原网页与后台，Workflows 每 10 分钟接续采集、预筛、双评分、中文编辑与事件任务，Hyperdrive 连接 Supabase 私有数据库。来源默认仅公开中文标题、摘要与原文链接；站内阅读不代表转载全文。部署步骤见 [完整 CF 部署](docs/cloudflare-full.md)。

全球目录收录 22 个来源，包括 Pitti Filati、Woolmark、Première Vision、SPINEXPO、SHIMA SEIKI、STOLL、Textile Exchange、Cotton Incorporated、Pantone、Lenzing、Vogue Runway、WWD、BoF、Knitting Industry 等。已接入的 RSS/网页列表与原站阅读入口分别标明，来源状态以实际采集结果为准。[信源核验记录](docs/knit-sources.md)。

### 旧版索引与回退

旧 D1 索引站保留在 [回退地址](https://knit-fashion-hot-legacy.534569779.workers.dev)，保留原数据，关闭自动采集。以下命令用于旧版本机开发；旧版部署使用 `npm run cf:legacy:deploy`，不会覆盖正式站。

```powershell
# Node.js >= 24.11
npm ci
npm run cf:dev
```

打开 http://localhost:8787。本地默认不启动外部采集。

```powershell
npm run cf:check
```

旧版 D1 部署及回退说明见 [旧版部署](docs/cloudflare.md)。GitHub Actions 先检查，正式发布仅由 main 的手动工作流触发，部署完整运行时。密钥通过本机登录或 GitHub Secrets 配置，不写入仓库。

## 保留的 AI 精编框架

原 React Router + Fastify + PostgreSQL + pg-boss 引擎仍保留。`site/` 已替换为本站品牌；`industry/` 已改为针织行业词表、主题、信源和模型提示词。`modules/cloudflare-full/` 将原网页、Fastify 公开路由、采集、双次独立评分、中文写作与持久任务队列适配到 Workers + Workflows + Hyperdrive + Supabase，不以静态链接目录替代原引擎。[CF 适配](docs/cloudflare-full.md)，[原服务器部署](docs/deploy.md)。

评分门槛保留上游数值，尚待针织行业人工样本重新校准，不声称已达到精选准确率。行业示例是评测 fixture，不作为线上新闻。原引擎的 category key 为兼容保持不变，显示标签已替换为针织行业。

## 主要文件

| 路径 | 用途 |
|---|---|
| `modules/cloudflare/` | Cloudflare 前端、Worker、D1 迁移、解析与集成测试 |
| `modules/cloudflare-full/` | 原引擎的 CF 网页、API、工作流及并发/队列适配测试 |
| `industry/source-directory.json` | Cloudflare 全球信源与采集配置 |
| `industry/sources.json` | PostgreSQL 原框架初始 RSS 来源 |
| `industry/taxonomy.ts`、`topics.json`、`prompts/` | 针织分类、主题与行业判断标准 |
| `site/site.ts`、`site/brand/` | 站名、文案、图标和报头 |
| `docs/cloudflare.md` | 部署、维护、接口及两个版本的功能差异 |

## 版权与使用

来源原文版权归各发布者。默认仅展示公开标题、短摘要及原文链接，订阅内容前往来源方阅读。代码沿用 [MIT](LICENSE) 许可，保留上游归属及 [NOTICE](NOTICE) 中的字体许可。
