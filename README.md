# 针织时尚 HOT

**从一根纱，看见下一季。** 面向针织服装设计师、买手与研发团队的全球趋势及产业资讯项目，基于 [AIHOT](https://github.com/KKKKhazix/AIHOT) 开源框架改造。

**在线访问：[针织时尚 HOT](https://knit-fashion-hot.534569779.workers.dev)** · [RSS 订阅](https://knit-fashion-hot.534569779.workers.dev/feed.xml)

**原引擎中文版预览：[全部动态](https://knit-hot-web.534569779.workers.dev/all)**。已连接 Supabase，原网页、公开读取、真实 MiniMax 中文编辑和 Cloudflare Workflows 已跑通。后台、图片存储和完整成刊链路仍在分阶段验收；旧版入口继续保留。[完整适配进度](docs/cloudflare-full.md)。

关注五条主线：**秀场与趋势、纱线与色彩、针织与工艺、品牌与市场、可持续材料**。

## Cloudflare 版本

使用 Cloudflare Workers + D1 + Cron Triggers，提供杂志风格响应式首页、资讯索引、分类与搜索、时间筛选、阅读简报、本机收藏、全球信源目录、RSS 和只读 JSON API。标题与短摘要保留原文；没有发布日期的条目清楚标明收录时间。

全球目录收录 22 个来源，包括 Pitti Filati、Woolmark、Première Vision、SPINEXPO、SHIMA SEIKI、STOLL、Textile Exchange、Cotton Incorporated、Pantone、Lenzing、Vogue Runway、WWD、BoF、Knitting Industry 等。已接入的 RSS/网页列表与原站阅读入口分别标明，来源状态以实际采集结果为准。[信源核验记录](docs/knit-sources.md)。

```powershell
# Node.js >= 24.11
npm ci
npm run cf:dev
```

打开 http://localhost:8787。本地默认不启动外部采集。

```powershell
npm run cf:check
```

首次在 Cloudflare 创建 D1、填写数据库 ID、迁移后执行 `npm run cf:deploy`。完整步骤及 GitHub Actions 自动部署配置见 **[Cloudflare 部署](docs/cloudflare.md)**。密钥通过本机登录或 GitHub Secrets 配置，不写入仓库。

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
