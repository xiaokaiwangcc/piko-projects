# piko-projects

Piko 出品 · 由 AI 协作完成并真实上线的项目合集。

| 项目 | 说明 | 线上地址 |
| --- | --- | --- |
| [board-demo](board-demo) | 海斗助手（英雄别称搜索 / 装备与符文推荐 / 胜率榜）+ 留言板 Demo，共用 Cloudflare Pages + D1 + Worker，附 MCP 服务 | https://haidou.pages.dev |

## 结构

- `board-demo/web` — Vite + React + TS 前端（`/` 留言板，`/haidou` 海斗助手）
- `board-demo/worker` — 单文件零依赖 Worker：`/api/*` 与 `/mcp`
- `board-demo/scripts` — 数据构建、英雄别称表、Pages Worker 打包脚本
- `board-demo/infra` — 部署与回滚手册（DEPLOY.md）
- `board-demo/docs` — 验收清单与证据截图

每个项目目录下有独立 README，写清本地启动方式。

## 数据来源

海斗助手使用第三方公开的对局统计数据（已按站点要求去除来源标注，数据仅用于学习与演示）。
