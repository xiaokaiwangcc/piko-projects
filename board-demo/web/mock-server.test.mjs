import assert from 'node:assert/strict';
import test from 'node:test';
import { createApi } from './mock-server.mjs';

async function call(api, method, pathname, body) {
  return api.handle({
    method,
    pathname,
    rawBody: body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

test('空列表返回 items: []', async () => {
  const api = createApi();
  const result = await call(api, 'GET', '/api/notes');
  assert.equal(result.status, 200);
  assert.deepEqual(result.payload, { items: [] });
});

test('新增：trim、返回 201、倒序排列', async () => {
  const api = createApi();
  const first = await call(api, 'POST', '/api/notes', { content: '  第一条  ' });
  const second = await call(api, 'POST', '/api/notes', { content: '第二条' });

  assert.equal(first.status, 201);
  assert.equal(first.payload.item.content, '第一条');
  assert.equal(second.status, 201);
  assert.equal(typeof first.payload.item.created_at, 'string');

  const list = await call(api, 'GET', '/api/notes');
  assert.deepEqual(list.payload.items.map((item) => item.content), ['第二条', '第一条']);
});

test('新增：空内容、纯空格、超长、超过 200 个 emoji', async () => {
  const api = createApi();
  assert.equal((await call(api, 'POST', '/api/notes', { content: '' })).payload.error.code, 'EMPTY_CONTENT');
  assert.equal((await call(api, 'POST', '/api/notes', { content: '   ' })).payload.error.code, 'EMPTY_CONTENT');
  assert.equal((await call(api, 'POST', '/api/notes', { content: 'a'.repeat(201) })).payload.error.code, 'TOO_LONG');

  const exactly200 = await call(api, 'POST', '/api/notes', { content: '😀'.repeat(200) });
  assert.equal(exactly200.status, 201);
  const over200 = await call(api, 'POST', '/api/notes', { content: '😀'.repeat(201) });
  assert.equal(over200.payload.error.code, 'TOO_LONG');
});

test('新增：非法 JSON 与非对象 body', async () => {
  const api = createApi();
  assert.equal((await call(api, 'POST', '/api/notes', '{bad')).payload.error.code, 'BAD_JSON');
  assert.equal((await call(api, 'POST', '/api/notes', '[1,2]')).payload.error.code, 'BAD_JSON');
  assert.equal((await call(api, 'POST', '/api/notes', 'null')).payload.error.code, 'BAD_JSON');
});

test('删除：成功、非法 id、不存在 id', async () => {
  const api = createApi();
  const created = await call(api, 'POST', '/api/notes', { content: '待删除' });
  const id = created.payload.item.id;

  assert.equal((await call(api, 'DELETE', '/api/notes/abc')).payload.error.code, 'BAD_ID');
  assert.equal((await call(api, 'DELETE', '/api/notes/0')).payload.error.code, 'BAD_ID');
  const missing = await call(api, 'DELETE', '/api/notes/999');
  assert.equal(missing.status, 404);
  assert.equal(missing.payload.error.code, 'NOT_FOUND');

  const removed = await call(api, 'DELETE', `/api/notes/${id}`);
  assert.equal(removed.status, 200);
  assert.deepEqual(removed.payload, { ok: true });
  assert.deepEqual((await call(api, 'GET', '/api/notes')).payload.items, []);
});

test('未知路由返回 404 NOT_FOUND', async () => {
  const api = createApi();
  const result = await call(api, 'GET', '/api/unknown');
  assert.equal(result.status, 404);
  assert.equal(result.payload.error.code, 'NOT_FOUND');
});
