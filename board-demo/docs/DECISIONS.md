# 决策记录

## D1（2026-11-04）后端不使用 Hono
- 背景：执行环境终端无外网（DNS 不可达），无法 npm install，也无法安装 wrangler；本机仅有前端项目的 node_modules 可复用，其中没有 hono。
- 决策：Worker 用零依赖的单文件 TypeScript/JS 实现，路由、校验、CORS、错误结构与 `API-CONTRACT.md` 完全一致。
- 影响：API 契约不变，前端无感；后续恢复网络后可按需替换为 Hono，路由层替换成本低。
- 状态：待上线验证。

## D2（2026-11-04）部署走浏览器控制台
- 背景：终端无外网，`wrangler login/deploy` 在本机不可用；Chrome 可正常出网。
- 决策：本次上线通过 Cloudflare 控制台完成（D1 建库 + SQL 执行 migration + Worker 粘贴代码 + Pages 上传单文件产物）；仓库仍保留标准 wrangler 配置，README 记录正规流程。
- 影响：本次上线依赖人工浏览器操作，可复现性弱于 CLI；已在 README 标注。

## D3（2026-11-04 17:22）API 改为 Pages 同源，不再依赖 workers.dev
- 背景：`*.workers.dev` 在部分网络（实测：大管家所在网络）表现为 ERR_TIMED_OUT / ERR_CONNECTION_CLOSED，而 `board-demo-web.pages.dev` 同一网络可正常打开。跨域架构把可用性绑在了最脆弱的一跳上。
- 决策：用 Pages Functions advanced mode 接管 `/api/*`，其余请求交给 `env.ASSETS`；前端 `VITE_API_BASE` 留空，走相对路径。接口实现仍只有一份 `worker/src/index.js`，`web/public/_worker.js` 由 `scripts/build-pages-worker.mjs` 生成。
- 证据：`docs/evidence/api-checks-sameorigin.txt`；外部（IAD）请求 `/api/health` 得 200 + Date/CF-RAY，`/api/notes` 返回真实数据。
- 代价：Pages 项目必须配置 D1 绑定（preview + production）；`_worker.js` 是构建产物，改动接口后必须重新构建再上传。
- 状态：已上线并验收通过（A2/A3/A4/A8/A11/A12）。
