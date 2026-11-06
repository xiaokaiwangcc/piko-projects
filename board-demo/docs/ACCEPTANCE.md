# 验收清单（逐条留证据，未验证不许勾）

| # | 验收项 | 判定方式 | 证据 | 状态 |
|---|---|---|---|---|
| A1 | 前端公网 URL 可直接打开 | 访问 `https://board-demo-web.pages.dev/` 渲染留言板 | `docs/evidence/01-live-list.png` | 通过（2026-11-04） |
| A2 | `/api/health` 返回 JSON | `GET https://board-demo-web.pages.dev/api/health` = `{"ok":true}`，同源，200 | `api-checks-sameorigin.txt` | 通过（2026-11-04 17:22，同源） |
| A3 | 新增留言真落库 | 页面新增 → 刷新 → 记录仍在 | `api-checks-sameorigin.txt` 第五节 | 通过（同源链路实测，17:23） |
| A4 | 删除留言真删库 | 页面删除 → 刷新 → 消失 | `api-checks-sameorigin.txt` 第五节 | 通过（同源链路实测，17:23） |
| A5 | 校验与异常态 | 空内容 400 `EMPTY_CONTENT`、201 字 400 `TOO_LONG` | `docs/evidence/api-checks.txt` | 通过（删除不存在 id 未单独实测） |
| A6 | 前端 loading/error 态 | 用线上同一份 HTML/JS 注入 8s 延迟与强制 500，骨架、错误提示与重试均正常 | `docs/evidence/board-online-loading.png`、`board-online-error.png` | 通过 |
| A7 | 移动端可用 | 390px 视口下布局与本地一致，无横向溢出，输入与列表可用 | `docs/evidence/board-online-mobile-390.png` | 通过 |
| A8 | 前端能取到真实数据 | 线上页面读取列表并渲染真实数据 | `07-sameorigin-live.png` | 通过（同源 `/api`，无跨域） |
| A9 | README 完整 | 本地启动、wrangler 部署、免费额度、绑域名步骤齐备 | `README.md`、`infra/DEPLOY.md` | 通过 |
| A10 | 国内访问说明 | README 写明国内访问限制与退路：部分大陆网络无法直连 `workers.dev`，主链路走 Pages 同源；并给出自有域名 + 备案 + 境内节点等退路 | `README.md` 国内访问说明 | 通过 |
| A11 | 主链路不依赖 workers.dev | 前端构建产物不含 `workers.dev`；`/api/*` 与页面同域 | `api-checks-sameorigin.txt` 一/二/三 | 通过（2026-11-04 17:24） |
| A12 | 外部网络可达 | 外部网络请求 `/api/health` 得 200；`/api/notes` 返回真实数据 | `api-checks-sameorigin.txt` 二/三 | 通过（2026-11-04 17:24） |
| A13 | 境内同源读写链路 | 境内第三方观测点直连 Pages 同源：`/api/health` 200、`/api/notes` 200、POST 201、DELETE 200 | 第三方实测记录，2026-11-04 | 通过（单点实测，不代表全国） |

## 海斗助手（2026-11-05 新增）

| # | 验收项 | 判定方式 | 证据 | 状态 |
|---|---|---|---|---|
| H1 | 页面可公网打开 | `https://board-demo-web.pages.dev/haidou` 渲染首页，`.html` 自动跳转到无后缀路径 | `docs/evidence/08-haidou-home.png` | 通过（2026-11-05 17:19） |
| H2 | 按英雄名搜索 | 输入「亚索」出现下拉候选，点击进入详情 `#/c/157` | 实机点击 + 详情页正文 | 通过 |
| H3 | 推荐装备按真实统计展示 | 亚索暴击套：核心 3 件、鞋子、出门装、后续 3 件、技能加点与召唤师技能均来自快照 | `docs/evidence/09-haidou-detail.png` | 通过 |
| H4 | 强化榜可排序与展开说明 | 默认胜率优先，可切登场优先；点开「鼓声暴起 低音轰鸣」显示完整说明 | `docs/evidence/12-haidou-augments.png` | 通过 |
| H5 | 胜率榜完整可筛选 | 173 位英雄按胜率降序，定位筛选 chips 与英雄筛选框可用，显示版本与统计日期 | `docs/evidence/10-haidou-rank.png` | 通过 |
| H6 | 移动端可用 | 390px 与 320px 视口下 `scrollWidth == clientWidth`，无横向溢出；导航单行（56px）、英雄卡单列 | `docs/evidence/16-haidou-mobile-390-home-v2.png`、`17-haidou-mobile-390-list-v2.png`、`18-haidou-mobile-320-v2.png` | 通过（iframe 视口实测） |
| H7 | 静态数据可取且不依赖新后端 | `GET /data/haidou.json` 200 `application/json`；`GET /api/health` 仍 200 `{"ok":true}` | 浏览器同源 fetch 实测 | 通过 |
| H8 | 数据来源不对外展示、内部可追溯 | 页面与 `/data/haidou.json` 的 `meta` 不含来源字段与 LOLDAA 字样，仅保留版本、统计日期与「非官方」声明；README 与生成脚本保留内部追溯 | `docs/evidence/20-haidou-mcp.txt`、`README.md`、`scripts/build-haidou-data.mjs` | 通过（2026-11-05 19:06） |
| H9 | 视觉重构（PC + 移动） | 首页双栏 Hero + 头名英雄卡 + 数据条；英雄卡横向紧凑 4 列（移动 1 列）；详情页装备两栏；胜率榜行式排行；390/320 无溢出、标题单行 | `docs/evidence/13-haidou-home-v2.png`、`14-haidou-detail-v2.png`、`15-haidou-rank-v2.png` | 通过（2026-11-05 18:25 线上实拍） |
| H10 | 英雄别称/拼音搜索 | 首页搜索「压缩」「快乐风男」「yasuo」「ys」均命中亚索并显示命中标签；胜率榜筛选「卡牌」「ez」可用 | `docs/evidence/19-haidou-alias-search.png` | 通过（2026-11-05 19:05 线上） |
| H11 | MCP 可接入大模型 | `POST /mcp` 支持 initialize / tools/list / tools/call；6 个工具返回中文 Markdown；`GET /mcp` 405 | `docs/evidence/20-haidou-mcp.txt` | 通过（2026-11-05 19:06 线上） |
| H12 | 访问统计可用 | Cloudflare Web Analytics 已启用并部署；线上 HTML 含 beacon（token 与后台站一致）；后台已出数：2 次访问 / 2 次页面浏览 / 页面加载 542ms | `docs/evidence/21-web-analytics.png` | 通过（2026-11-05 23:39，数据为联调测试访问） |
| H13 | 海斗专属域名 | `https://haidou.pages.dev/` 根路径即海斗页（标题「海斗助手」）；`/api/health` 200、`/api/notes` 200、POST 201 / DELETE 200（测试数据已清理）；`POST /mcp` initialize 200；Web Analytics beacon 已注入 | `docs/evidence/22-haidou-domain.png` | 通过（2026-11-05 23:53） |

## 阻断发布标准
- A1/A2/A3/A4/A8 任一不过 → 不发布
- A6/A7/A9/A10 不过 → 记缺陷，评估是否阻断（默认阻断 README 项）

## 免费额度红线（写进 README）
- Workers Free：10 万请求/天，单次 CPU 10ms，超出返回错误
- Pages：带宽/请求不限，500 次构建/月，单次部署文件数上限
- D1 Free：5GB 存储，500 万行读/天，10 万行写/天
- 无 SLA，账号级免费额度，不得用于生产关键业务
