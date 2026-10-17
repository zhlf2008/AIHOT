# 原引擎的 Cloudflare 运行时适配

`web/` 复用原 React Router 页面，通过 service binding 调用 `api/` 的原 Fastify 公开读取路由。`jobs/` 通过 Workflows 有限步骤接续原 pg-boss 持久任务，连接 Supabase 私有 schema。业务判断、回执、预算和 publication 公开范围保持原引擎实现。

`platform-build.mjs` 只替换运行时边界：数据库、出网、任务上下文、按需图片模块，每项源变换有漂移检查。路由 JIT 使用保持语义的循环实现，并做原版/转换版正负约束差分测试。数据库和队列上下文通过 AsyncLocalStorage 隔离，队列事务和跨实例事件串行均有本地 PostgreSQL 测试。

`npm run cf:full:build` 生成三个独立发布包，产物仅写入忽略提交的 `.build/`。公开资源采用构建时白名单，不打包 `.env`、`.data` 或数据库密码。原 `apps/web/build` 不被覆盖。

`media/` 是不开放 workers.dev 的私有 WASM 服务，通过 Workflow 执行较重处理，KV 保存衍生图与管理员联系人图片；只随包加载字体。原 OG/海报模板和签名代理路由继续复用，光栅转换有边缘内存限制。

正式入口：<https://knit-fashion-hot.534569779.workers.dev/all>。使用者已开通 Workers Paid；普通分享图、1080×1440 手机海报、签名图片代理、后台与真实 12 项批处理均已在线验证。完整部署、阀门、预算、实测与待验收项见 [部署记录](../../docs/cloudflare-full.md)。
