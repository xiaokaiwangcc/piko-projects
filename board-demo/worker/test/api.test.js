import test from 'node:test';
import assert from 'node:assert/strict';
import { handleRequest } from '../src/index.js';
import { FakeD1 } from './fake-d1.js';

const BASE = 'https://board-demo-api.example.workers.dev';
const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function call(path, { method = 'GET', body, contentType = 'application/json' } = {}, env = { DB: new FakeD1() }) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
    init.headers['Content-Type'] = contentType;
  }
  return handleRequest(new Request(BASE + path, init), env);
}

async function json(response) {
  assert.equal(response.headers.get('content-type'), 'application/json; charset=utf-8');
  return response.json();
}

test('CORS：普通响应带跨域头，preflight 返回 204', async () => {
  const res = await call('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.equal(res.headers.get('access-control-allow-methods'), 'GET, POST, DELETE, OPTIONS');
  assert.equal(res.headers.get('access-control-allow-headers'), 'Content-Type');

  const pre = await call('/api/notes', { method: 'OPTIONS' });
  assert.equal(pre.status, 204);
  assert.equal(pre.headers.get('access-control-allow-origin'), '*');
  assert.equal(await pre.text(), '');
});

test('health：200 {"ok":true}', async () => {
  const res = await call('/api/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await json(res), { ok: true });
});

test('列表：空库返回 items: []（不是 null）', async () => {
  const res = await call('/api/notes');
  assert.equal(res.status, 200);
  const data = await json(res);
  assert.ok(Array.isArray(data.items));
  assert.deepEqual(data.items, []);
});

test('新增：201 落库，trim 后存储，created_at 为 ISO-8601 UTC', async () => {
  const env = { DB: new FakeD1() };
  const res = await call('/api/notes', { method: 'POST', body: { content: '  你好，世界  ' } }, env);
  assert.equal(res.status, 201);

  const { item } = await json(res);
  assert.equal(item.content, '你好，世界');
  assert.match(item.created_at, ISO_UTC);
  assert.equal(item.created_at, new Date(item.created_at).toISOString());
  assert.equal(typeof item.id, 'number');

  assert.equal(env.DB.notes.length, 1);
  assert.equal(env.DB.notes[0].content, '你好，世界');

  const listed = await json(await call('/api/notes', {}, env));
  assert.equal(listed.items.length, 1);
  assert.deepEqual(listed.items[0], item);
});

test('列表：按 created_at 倒序 + id 倒序，最多 100 条', async () => {
  const env = { DB: new FakeD1() };
  env.DB.seed([
    { id: 1, content: 'a', created_at: '2026-11-04T08:00:00.000Z' },
    { id: 2, content: 'b', created_at: '2026-11-04T09:00:00.000Z' },
    { id: 3, content: 'c', created_at: '2026-11-04T09:00:00.000Z' },
  ]);
  const data = await json(await call('/api/notes', {}, env));
  assert.deepEqual(data.items.map((n) => n.id), [3, 2, 1]);

  const big = { DB: new FakeD1() };
  for (let i = 1; i <= 105; i += 1) {
    await call('/api/notes', { method: 'POST', body: { content: `n${i}` } }, big);
  }
  const capped = await json(await call('/api/notes', {}, big));
  assert.equal(capped.items.length, 100);
  assert.equal(capped.items[0].content, 'n105');
});

test('校验：trim 后为空 → 400 EMPTY_CONTENT', async () => {
  for (const content of ['', '   ', '\n\t ']) {
    const res = await call('/api/notes', { method: 'POST', body: { content } });
    assert.equal(res.status, 400);
    const data = await json(res);
    assert.equal(data.error.code, 'EMPTY_CONTENT');
    assert.equal(data.error.message, '留言内容不能为空');
  }
});

test('校验：200 字通过、201 字 TOO_LONG，按 Unicode 字符数计', async () => {
  const ok200 = await call('/api/notes', { method: 'POST', body: { content: '字'.repeat(200) } });
  assert.equal(ok200.status, 201);

  const bad201 = await call('/api/notes', { method: 'POST', body: { content: '字'.repeat(201) } });
  assert.equal(bad201.status, 400);
  assert.equal((await json(bad201)).error.code, 'TOO_LONG');

  const emoji200 = await call('/api/notes', { method: 'POST', body: { content: '😀'.repeat(200) } });
  assert.equal(emoji200.status, 201);

  const emoji201 = await call('/api/notes', { method: 'POST', body: { content: '😀'.repeat(201) } });
  assert.equal(emoji201.status, 400);
  assert.equal((await json(emoji201)).error.code, 'TOO_LONG');
});

test('校验：非法 JSON / 非对象 → 400 BAD_JSON', async () => {
  const cases = ['{not json', '[]', 'null', '"text"', '123'];
  for (const body of cases) {
    const res = await call('/api/notes', { method: 'POST', body });
    assert.equal(res.status, 400, `body=${body}`);
    assert.equal((await json(res)).error.code, 'BAD_JSON');
  }
});

test('删除：存在的 id → 200 且记录消失', async () => {
  const env = { DB: new FakeD1() };
  const created = await json(await call('/api/notes', { method: 'POST', body: { content: '待删除' } }, env));

  const res = await call(`/api/notes/${created.item.id}`, { method: 'DELETE' }, env);
  assert.equal(res.status, 200);
  assert.deepEqual(await json(res), { ok: true });
  assert.deepEqual((await json(await call('/api/notes', {}, env))).items, []);
});

test('删除：不存在的 id → 404 NOT_FOUND，不是 500', async () => {
  const res = await call('/api/notes/999', { method: 'DELETE' });
  assert.equal(res.status, 404);
  const data = await json(res);
  assert.equal(data.error.code, 'NOT_FOUND');
  assert.equal(data.error.message, '留言不存在');
});

test('删除：非法 id → 400 BAD_ID', async () => {
  for (const id of ['abc', '0', '-1', '1.5', '1e3', '99999999999999999999']) {
    const res = await call(`/api/notes/${id}`, { method: 'DELETE' });
    assert.equal(res.status, 400, `id=${id}`);
    const data = await json(res);
    assert.equal(data.error.code, 'BAD_ID');
    assert.equal(data.error.message, '留言 ID 不合法');
  }
});

test('未知路由 → 404 NOT_FOUND 接口不存在', async () => {
  for (const [path, method] of [['/', 'GET'], ['/api', 'GET'], ['/api/notes/1', 'GET'], ['/api/unknown', 'POST'], ['/api/notes/1', 'PUT']]) {
    const res = await call(path, { method });
    assert.equal(res.status, 404, `${method} ${path}`);
    const data = await json(res);
    assert.equal(data.error.code, 'NOT_FOUND');
    assert.equal(data.error.message, '接口不存在');
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  }
});

test('未捕获异常 → 500 INTERNAL，且不泄露内部细节', async () => {
  const env = { DB: new FakeD1() };
  env.DB.throwOnAll = true;
  const res = await call('/api/notes', {}, env);
  assert.equal(res.status, 500);
  const text = await res.text();
  assert.equal(text, JSON.stringify({ error: { code: 'INTERNAL', message: '服务异常，请稍后重试' } }));
  assert.ok(!text.includes('simulated D1 failure'));
});
