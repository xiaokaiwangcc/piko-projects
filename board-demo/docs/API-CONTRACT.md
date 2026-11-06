# API 契约 v1（前后端唯一依据）

后端 Base URL：`https://<worker-name>.<account>.workers.dev`（部署后回填）
前端通过 `VITE_API_BASE` 注入，代码里不得硬编码地址。

统一约定
- 请求/响应均为 `application/json; charset=utf-8`
- 错误统一结构：`{"error":{"code":"<CODE>","message":"<中文提示>"}}`
- 时间字段 `created_at` 为 ISO-8601 UTC 字符串，例如 `2026-11-04T08:12:33.000Z`
- 内容长度以 Unicode 字符数计（不是字节），上限 200
- CORS：允许 `*`；方法 `GET, POST, DELETE, OPTIONS`；头 `Content-Type`；preflight 返回 204

## GET /api/health
200 `{"ok":true}`

## GET /api/notes
200 `{"items":[{"id":1,"content":"...","created_at":"2026-11-04T08:12:33.000Z"}]}`
- 按 `created_at` 倒序、`id` 倒序
- 最多返回 100 条
- 空列表返回 `{"items":[]}`（不是 null）

## POST /api/notes
请求 `{"content":"..."}`
- 201 `{"item":{"id":2,"content":"...","created_at":"..."}}`
- 400 `EMPTY_CONTENT`：trim 后为空
- 400 `TOO_LONG`：trim 后超过 200 字
- 400 `BAD_JSON`：body 不是合法 JSON 或不是对象
- 存储前 trim，落库为 trim 后的值

## DELETE /api/notes/:id
- 200 `{"ok":true}`
- 400 `BAD_ID`：id 不是正整数
- 404 `NOT_FOUND`：id 不存在
- 删除不存在记录不得报 500

## 其他
- 未匹配路由：404 `{"error":{"code":"NOT_FOUND","message":"接口不存在"}}`
- 任何未捕获异常：500 `{"error":{"code":"INTERNAL","message":"服务异常，请稍后重试"}}`，且日志可见
