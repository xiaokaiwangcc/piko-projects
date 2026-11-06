-- 留言表：content 存 trim 后内容，created_at 存 ISO-8601 UTC 字符串
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_created_at_id ON notes (created_at DESC, id DESC);
