# 控制台部署说明（无 wrangler / 无外网环境）

后端没有任何构建步骤、没有第三方依赖。**打包产物就是 `src/index.js` 这一个文件**，整段复制粘贴即可。

## 1. 建 D1 数据库
Cloudflare 控制台 → Workers & Pages → D1 → Create database，名称：`board-demo-db`。
创建后记下 **Database ID**（UUID）。

## 2. 执行 migration
进入该 D1 → Console / Query，粘贴 `migrations/0001_init.sql` 全文并执行：

```sql
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notes_created_at_id ON notes (created_at DESC, id DESC);
```

验证：`SELECT name FROM sqlite_master WHERE type='table' AND name='notes';` 应返回一行。

## 3. 建 Worker 并粘贴代码
Workers & Pages → Create → Worker，名称：`board-demo-api` → Deploy → Edit code。
删除模板内容，粘贴 `src/index.js` 全文（ES Module 格式，含 `export default { fetch }`）→ Deploy。

## 4. 绑定 D1 与兼容日期
Worker → Settings → Runtime：
- Compatibility date：`2026-11-01`
- Bindings → Add → D1 database，**Variable name 必须是 `DB`**，选择 `board-demo-db`

改完 Deploy 一次。

## 5. 部署后自测
```bash
BASE_URL=https://board-demo-api.<你的子域>.workers.dev bash scripts/smoke.sh
```
脚本逐条打印契约用例的 HTTP 状态与响应体。

## 6. 之后如需 wrangler
`worker/wrangler.toml` 保留标准配置，把 `database_id = "__D1_DATABASE_ID__"` 换成真实 UUID 后即可 `npm install && npx wrangler deploy`（需能访问 npm 与 Cloudflare 的网络）。
