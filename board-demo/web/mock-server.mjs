// 本地开发用 Mock API：数据仅存内存，重启即清空。不参与生产打包。
// 用法：node mock-server.mjs
// 可选环境变量：PORT（默认 8787）、MOCK_DELAY_MS（模拟网络延迟）、MOCK_FAIL=1（所有请求返回 500）
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

const PORT = Number(process.env.PORT ?? 8787);
const DELAY = Number(process.env.MOCK_DELAY_MS ?? 0);
const FORCE_FAIL = process.env.MOCK_FAIL === '1';
const MAX_LENGTH = 200;

export function createApi() {
  let nextId = 1;
  const notes = [];

  function fail(status, code, message) {
    return { status, payload: { error: { code, message } } };
  }

  function parseContent(rawBody) {
    let body;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return { error: fail(400, 'BAD_JSON', '请求体不是合法的 JSON') };
    }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return { error: fail(400, 'BAD_JSON', '请求体必须是 JSON 对象') };
    }

    const content = typeof body.content === 'string' ? body.content.trim() : '';
    if (!content) {
      return { error: fail(400, 'EMPTY_CONTENT', '留言内容不能为空') };
    }
    if (Array.from(content).length > MAX_LENGTH) {
      return { error: fail(400, 'TOO_LONG', `留言内容不能超过 ${MAX_LENGTH} 字`) };
    }
    return { content };
  }

  return {
    async handle({ method, pathname, rawBody = '' }) {
      if (method === 'GET' && pathname === '/api/health') {
        return { status: 200, payload: { ok: true } };
      }

      if (method === 'GET' && pathname === '/api/notes') {
        const items = notes
          .slice()
          .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id)
          .slice(0, 100);
        return { status: 200, payload: { items } };
      }

      if (method === 'POST' && pathname === '/api/notes') {
        const parsed = parseContent(rawBody);
        if (parsed.error) return parsed.error;

        const item = { id: nextId++, content: parsed.content, created_at: new Date().toISOString() };
        notes.push(item);
        return { status: 201, payload: { item } };
      }

      const deleteMatch = pathname.match(/^\/api\/notes\/([^/]+)$/);
      if (method === 'DELETE' && deleteMatch) {
        const rawId = deleteMatch[1];
        if (!/^[1-9]\d*$/.test(rawId)) {
          return fail(400, 'BAD_ID', '留言 ID 不合法');
        }

        const index = notes.findIndex((note) => note.id === Number(rawId));
        if (index === -1) {
          return fail(404, 'NOT_FOUND', '留言不存在或已被删除');
        }

        notes.splice(index, 1);
        return { status: 200, payload: { ok: true } };
      }

      return fail(404, 'NOT_FOUND', '接口不存在');
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 64 * 1024) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

export function startServer(port = PORT) {
  const api = createApi();
  const server = createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (DELAY > 0) await new Promise((resolve) => setTimeout(resolve, DELAY));

    if (FORCE_FAIL) {
      sendJson(res, 500, { error: { code: 'INTERNAL', message: '服务异常，请稍后重试' } });
      return;
    }

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);
    try {
      const rawBody = await readBody(req);
      const result = await api.handle({ method: req.method ?? 'GET', pathname: url.pathname, rawBody });
      sendJson(res, result.status, result.payload);
    } catch {
      sendJson(res, 413, { error: { code: 'BAD_JSON', message: '请求体过大' } });
    }
  });

  server.listen(port, () => {
    console.log(`Mock API running at http://localhost:${port}`);
    console.log('数据仅存内存，重启后清空；生产请使用 Cloudflare Worker。');
  });

  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
