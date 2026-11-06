# board-demo · Web

Vite + React + TypeScript 前端。接口契约见 `../docs/API-CONTRACT.md`。

## 环境要求

- Node.js 20.19+（或 22.12+）
- npm 10+

## 本地启动

```bash
cd web
npm install
cp .env.example .env.local   # 默认指向本地 Mock：http://localhost:8787
```

开两个终端：

```bash
# 终端 1：本地 Mock API（数据仅存内存，重启清空）
npm run mock

# 终端 2：前端开发服务器
npm run dev
```

浏览器打开终端提示的地址（默认 `http://localhost:5173`）。

## 环境变量

| 变量 | 说明 | 示例 |
| --- | --- | --- |
| `VITE_API_BASE` | Worker API 根地址，**不要**以 `/api` 结尾 | `https://board-api.example.workers.dev` |

代码中不硬编码后端地址。`VITE_API_BASE` 在构建时注入，Cloudflare Pages 部署需在项目环境变量中配置；修改后要重新构建。

## 常用命令

```bash
npm run dev      # 开发服务器
npm run build    # 类型检查 + 生产构建（产物在 dist/）
npm run preview  # 预览生产构建
npm run mock     # 本地 Mock API（端口 8787）
npm test         # Mock API 契约 + 前端 API 层测试（12 项）
```

Mock 支持两个调试开关：

```bash
MOCK_DELAY_MS=1500 npm run mock   # 延迟响应，查看 loading 态
MOCK_FAIL=1 npm run mock          # 全部返回 500，查看错误 + 重试态
```

## 已实现状态

- 首屏加载骨架屏；加载失败显示错误信息与「重试」按钮
- 200 字计数（按 Unicode 字符计）；超限时输入框标红并禁用发布
- 提交中禁用按钮；提交失败保留输入并提示，可直接重试
- 删除前浏览器确认；删除中禁用按钮；删除失败顶部提示
- 空列表状态
- 时间按浏览器本地时区格式化为 `YYYY/MM/DD HH:mm`
- 390px 窄屏适配、键盘焦点样式、语义化标签

## 待联调

- `VITE_API_BASE` 指向真实 Worker 地址后，验证 GET/POST/DELETE 与 CORS
- 公网 Pages 地址下的首屏、移动端实机验证

## 注意

当前无登录、无上传、无分页（按契约最多返回 100 条）。`mock-server.mjs` 仅用于本地开发，不进入生产构建。
