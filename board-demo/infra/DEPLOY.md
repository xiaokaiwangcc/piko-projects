# board-demo 部署手册

> 负责人：运维小博 · 最后更新：2026-11-04
> 适用环境：**公网 Demo（单人维护，非生产）**

## 0. 资源清单与命名（唯一真源）

| 资源 | 类型 | 名称 | 说明 |
|---|---|---|---|
| 主链路 API | Pages Functions | `board-demo-web` 的 `/api/*` | `web/public/_worker.js`（由 `scripts/build-pages-worker.mjs` 从 `worker/src/index.js` 生成），与前端同域 |
| 备用 API | Worker | `board-demo-api` | 入口 `worker/src/index.js`；仅直连调试用，不在主链路上 |
| 数据库 | D1 | `board-demo-db` | 绑定变量名必须是 `DB` |
| 前端 | Pages | `board-demo-web` | 静态产物 `web/dist`（`index.html` + `assets/` + `_worker.js`） |
| 线上入口 | `*.pages.dev` | `https://board-demo-web.pages.dev` | 页面与 API 同域；`VITE_API_BASE` 留空 |

环境判定：本项目**只有一个环境（公网 Demo）**，没有 dev/staging/prod 分离；任何改动即是线上改动，因此每次发布都要跑 `worker/scripts/smoke.sh`。

### 账号与环境实测（2026-11-04，只读核对）

| 项 | 结论 |
|---|---|
| Cloudflare 登录态 | **已登录**（浏览器控制台，账号 `46528ce2…8cc9`，2025-05 创建） |
| 账号名 | `Xiaokaix***@gmail.com` 的个人账号（standard，无付费 Zone） |
| 订阅 | 无任何订阅 → Workers / Pages / D1 均为 **Free 计划** |
| 权限 | 成功调用 Workers scripts、Pages projects、D1 database 三类账号级 API（均 200，列表为空）→ 有建库与部署权限 |
| workers.dev 子域 | **`xiaokaixin12`**。Worker 备用直连 `https://board-demo-api.xiaokaixin12.workers.dev`，**仅海外调试用，不作可用性判据** |
| 现有资源 | 已创建并上线：Worker `board-demo-api`、Pages `board-demo-web`、D1 `board-demo-db`（勿重复创建） |

前置事实（实测，2026-11-04）：
- 本机终端**无出网能力**：DNS 不可达，直连 IP（1.1.1.1:443）7ms 失败，回环端口亦全部不可达 —— 执行进程被隔离在无网络的命名空间里。`npx wrangler` 实测报 `ENOTFOUND registry.npmjs.org`（即使提权亦然），故 CLI 路径在本机**不可用**，与网络策略无关，换镜像源无效。
- npm 全局与 `~/.npm/_npx` 缓存中均无 wrangler 离线副本；`~/.wrangler` 无任何登录凭证。
- Chrome 本身可正常出网，Cloudflare 控制台可用（需账号已登录）。
- 前端可离线构建：`board-demo/node_modules` 是指向 `~/workspace/live-complie/frontend/node_modules` 的软链，React/Vite 齐全。
- `node/npm/npx` 不在默认 PATH 里，真实位置是 `/opt/homebrew/bin/`（`/usr/local/bin` 下的同名项已失效）。所有构建命令前面加 `PATH=/opt/homebrew/bin:$PATH`。
- 已验证：`VITE_API_BASE=... npx vite build`（89ms）与 `npx tsc --noEmit`（无错误）均可在无网状态跑通，产物中能检出 API 域名。

---

## A. 标准命令行路径（网络恢复后的正规方式）

一次性准备：

```bash
cd board-demo/worker
npm install -D wrangler          # 或全局 npm i -g wrangler
npx wrangler login               # 浏览器授权，凭证写入本机
npx wrangler whoami              # 确认已登录、拿到 account id
```

> `wrangler.toml` 已修正：`main = "src/index.js"`、`database_id` 与线上一致、`compatibility_date = "2026-11-04"`（与线上运行时一致，回退会改变行为）。以下 `d1 create` 步骤**已执行过，勿重复执行**。

首次创建资源：

```bash
cd board-demo/worker
npx wrangler d1 create board-demo-db   # 已创建，跳过；只有重建时才执行
# 新库才需要把 database_id 写回 wrangler.toml（当前已回填 69d83f4d…）

npx wrangler d1 migrations apply board-demo-db --remote   # 执行 migrations/0001_init.sql
npx wrangler d1 execute board-demo-db --remote \
  --command "SELECT name FROM sqlite_master WHERE type='table'"   # 应看到 notes

npx wrangler deploy              # 发布 Worker
```

前端：

```bash
cd board-demo/web
VITE_API_BASE= npm run build                  # 留空 => 同源 /api；构建会先生成 _worker.js
npx wrangler pages deploy dist --project-name=board-demo-web
```

Pages 项目必须绑定 D1：Settings → Functions → D1 bindings → `DB` = `board-demo-db`（preview 与 production 都要配）。否则 `/api/*` 返回 500。

日常发布顺序（固定，不跳步）：

1. `wrangler d1 migrations apply board-demo-db --remote`（如有新 migration）
2. `wrangler deploy`（后端先行，保持向后兼容）
3. 前端构建 + `wrangler pages deploy`
4. `BASE_URL=... bash worker/scripts/smoke.sh`，全 PASS 才算发布成功

---

## B. 本机当前可用路径：浏览器控制台（本次上线用这条）

### B1. 建 D1 并执行 migration
1. 控制台 → Workers & Pages → **D1** → Create database → 名称 `board-demo-db`。
2. 记下 **Database ID**（UUID），填进 `wrangler.toml` 备用。
3. 进入该库 → Console/Query，粘贴 `worker/migrations/0001_init.sql` 全文执行。
4. 验证：`SELECT name FROM sqlite_master WHERE type='table' AND name='notes';` 返回一行。

### B2. 建 Worker 并粘贴代码
1. Workers & Pages → Create → Worker → 名称 `board-demo-api` → Deploy。
2. Edit code → 删掉模板 → 粘贴 `worker/src/index.js` **全文**（136 行）→ Deploy。
3. Settings → Runtime：Compatibility date `2026-11-04`（必须与线上当前值一致，别降回 11-01）。
4. Settings → Bindings → Add → **D1 database**，Variable name 必须是 `DB`，选 `board-demo-db` → Deploy 一次生效。
5. 记下分配到的 `https://board-demo-api.<子域>.workers.dev`。

### B3. 前端构建（本机，离线可做）
```bash
cd board-demo/web
export PATH=/opt/homebrew/bin:$PATH
VITE_API_BASE= npm run build   # 先生成 public/_worker.js，再 tsc --noEmit + vite build
```

自检（三条都要过）：
1. `ls dist/_worker.js` 存在。
2. `grep -c 'workers.dev' dist/assets/*.js` 应为 0（同源构建）。
3. `grep -o 'api/notes' dist/assets/*.js | head -1` 有输出（相对路径已打进产物）。

### B4. Pages 部署
1. Workers & Pages → Create → Pages → **Upload assets**（Direct Upload）→ 项目名 `board-demo-web`。
2. Settings → Functions → D1 bindings 添加 `DB` → `board-demo-db`（preview 与 production 各一次；也可用 API `PATCH /pages/projects/{name}` 的 `deployment_configs.*.d1_databases`）。
3. 上传 `web/dist` 打成的 zip（**zip 根目录必须直接是** `index.html`、`assets/`、`_worker.js`，不要多套一层文件夹）。
4. 环境选“生产”才会更新 `board-demo-web.pages.dev`；选“预览”只生成预览域名。

### B5. 验证
```bash
BASE_URL=https://board-demo-web.pages.dev bash board-demo/worker/scripts/smoke.sh
```
终端无网时改用：让有网的浏览器打开 `https://board-demo-web.pages.dev/api/health`、`/api/notes` 核对（**统一用 Pages 同源域名**；`*.workers.dev` 在大陆电信等网络 522/超时是链路问题，不能判为故障）。**逐条对照 `docs/ACCEPTANCE.md` 留证据。**

---

## 回滚

### 当前线上基线（2026-11-05，回滚时对照）

| 资源 | 当前版本 | 可回滚历史 |
|---|---|---|
| Worker `board-demo-api` | deployment `8ceb0dd1-ef90-48d6-87a7-07258170b114` / version `a806db9e-1572-4efd-a0db-ac328c5f0cf5`（16:48 上传） | 上一正常版本 `e1042ee8…` / `ef113881…`（16:38）；再往下是模板 `6cab979f…`（16:33），**仅 1 层可用回滚** |
| Pages `board-demo-web` | production deployment `3447ef23-2179-4446-b649-99a5cc78ea9c`（2026-11-05 17:17，success，含 `/haidou` 海斗助手），project `4ac3d569-b76f-4c6e-8189-9009399a058e` | 上一版 `e9760069-98c5-449c-a0ff-1d6189ef304c`（2026-11-04 17:22，无海斗页）；再往前 `6b30c52b-9c0b-4982-b954-9cca78719ed4`（16:51，同源前的旧版，前端指向 workers.dev） |
| D1 `board-demo-db` | `69d83f4d-c7ba-4912-94d6-beb5d22ef915`（16:30 创建） | 无版本概念，只能 Export 备份/恢复 |

Pages 项目已绑定的 D1 变量：`DB` → `69d83f4d-c7ba-4912-94d6-beb5d22ef915`（preview 与 production 各一份）。

### Worker 回滚
- 控制台：Workers & Pages → `board-demo-api` → **Deployments**（或 Versions）→ 选中上一个正常版本 → **Rollback / Deploy this version**。
- CLI：`npx wrangler rollback --name board-demo-api`（回退到上一版本），或 `npx wrangler versions list` 后指定版本部署。
- 回滚只改代码，**不动 D1 数据**。

### Pages 回滚
- 控制台：Pages → `board-demo-web` → Deployments → 上一个部署右侧 **⋯ → Rollback to this deployment**。
- Direct Upload 项目会保留历史部署，可逐次回滚；如需彻底下架，在 Settings 里删除项目（会断开 `pages.dev` 域名）。

### D1 备份与恢复
- 控制台导出：D1 → `board-demo-db` → **Export**（导出 SQL），存到本地 `~/Downloads/piko/board-demo/`。
- CLI 导出：`npx wrangler d1 export board-demo-db --remote --output=backup-$(date +%F).sql`。
- 恢复：新建库 → 执行导出的 SQL → 把 Worker 的 `DB` 绑定切到新库 → 验证 `/api/notes` 数据量与抽样记录 → 再删旧库。
- **注意**：`migrations/0001_init.sql` 只有 `CREATE TABLE IF NOT EXISTS`，没有 down 脚本；schema 变更必须另写迁移并在导出备份之后执行，**应用回滚不等于数据回滚**。
- 本项目为 Demo 数据，建议每次发布前手动导出一份，保留最近 3 份。

### 发布前快照（每次上线必做）
1. 记录当前 Worker 版本号与 Pages 当前部署 ID。
2. 导出 D1 SQL 备份。
3. 确认回滚目标可用（版本列表里确实存在上一个健康版本）。

---

## 免费额度红线（超了直接 5xx / 429，Demo 不做兜底）

| 项 | 免费额度 | 触顶表现 |
|---|---|---|
| Workers | 10 万请求/天，单次 CPU 10ms | 429 / 请求被拒 |
| Pages | 带宽与请求不限，构建 500 次/月，单次部署文件数与体积受限 | 构建失败、上传被拒 |
| D1 | 5GB 存储，500 万行读/天，10 万行写/天 | 查询报错 |
| 账号 | 无 SLA，额度为账号级共享 | 与其他 Demo 互相挤占 |

执行约束：
- 单条留言 ≤ 200 字（后端已限），列表固定 `LIMIT 100`，避免无界查询。
- 不做定时任务、批量导入、爬虫等放大读写的用法。
- **不得用于生产关键业务**；需要 SLA 时必须迁到付费计划或自有服务器。

---

## 绑定自有域名（后续）

1. 域名接入 Cloudflare（NS 指向 Cloudflare）。
2. Pages → Custom domains → 添加 `board.example.com`。API 与页面同源，**不需要单独的 `api.` 子域**。
3. 重新部署一次（产物不用改）。
4. 验证：`curl -s https://board.example.com/api/health` = `{"ok":true}`。

> 若仍想保留独立 API 域名，可另外给 Worker `board-demo-api` 绑 `api.example.com`，但要把前端 `VITE_API_BASE` 指回去，主链路就会重新依赖跨域，非必要不建议。

> 境内实测（2026-11-04，成都电信 AS4134）：`*.workers.dev` 是**域名级封锁**，19 个边缘 IP 全部 RST，换 IP 无效；`*.pages.dev` 是 **DNS 污染**，19 个边缘 IP 中 13 个可通（0.8–2.9s），页面与同源 `/api/*` 读写全链路可用。因此主链路定在 pages.dev 同源。但免费版无 SLA，`pages.dev` 若也被封锁，第一退路是自有域名 + 优选 CNAME，第二退路才是境内节点（云主机/CDN）+ ICP 备案。详见 README「国内访问说明」。

---

## 已知风险与待办

1. **前端必须按同源构建**：`VITE_API_BASE` 留空，产物里 `grep workers.dev` 应为 0、`_worker.js` 必须存在。若误带旧 `VITE_API_BASE`，前端会重新依赖 `workers.dev`，在部分网络（已验证：大管家所在网络）不可达。
2. 控制台手工路径不可复现、无审计记录；上线后尽快切回 A 路径（wrangler CLI）。
3. CORS 目前是 `Access-Control-Allow-Origin: *`，Demo 可接受，绑自有域名后建议收敛到具体来源。
4. 线上日志**确实没开**：实测 `logpush=false` 且无 observability 配置（`wrangler.toml` 里的 `observability.enabled` 未生效）。排障前先在 Worker Settings 手工开启，否则线上无日志可查。
5. 本次为绕过终端断网，临时在控制台创建过一个 API Token 用于调用部署接口，**已删除**（`/api/v4/user/tokens` 列表现为空）。如后续复现，用完必须删。

6. **522 误判记录（2026-11-04）**：`api.codetabs.com` / `api.allorigins.win` 返回的 522 页面自带 `Host: api.codetabs.com` 与独立 Ray ID，是代理服务自身故障，不是本项目的响应。不要再用这两个服务判定本项目可用性；用 `r.jina.ai`、hackertarget 或直连浏览器。

7. **域名级封锁 vs DNS 污染（2026-11-04 境内实测）**：`workers.dev` 在成都电信 AS4134 下探测 19 个边缘 IP，**0 个可通**，0.3s 内 RST —— 属域名级封锁，换 IP/优选 IP 救不了，只能放弃该域名。`pages.dev` 同一出口 13/19 可通（0.8–2.9s），同源读写全链路 200/201，属 DNS 污染，优选 IP 可救。主链路因此定在 pages.dev 同源 `/api/*`，`worker/` 仅作海外调试备用。**注意这是单点单运营商实测，不代表全国可用。**
