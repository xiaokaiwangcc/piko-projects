import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiError, createNote, deleteNote, listNotes } from './src/api.ts';

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  globalThis.fetch = handler as typeof fetch;
}

test('listNotes 解析 items', async () => {
  mockFetch(() =>
    new Response(
      JSON.stringify({ items: [{ id: 1, content: 'hi', created_at: '2026-11-04T08:12:33.000Z' }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );
  const data = await listNotes();
  assert.equal(data.items.length, 1);
  assert.equal(data.items[0].content, 'hi');
});

test('listNotes 遇到契约错误结构时抛出 ApiError', async () => {
  mockFetch(
    () =>
      new Response(JSON.stringify({ error: { code: 'INTERNAL', message: '服务异常，请稍后重试' } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  await assert.rejects(listNotes, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'INTERNAL');
    assert.equal(error.message, '服务异常，请稍后重试');
    return true;
  });
});

test('网络失败转为 NETWORK 错误', async () => {
  mockFetch(() => {
    throw new TypeError('Failed to fetch');
  });
  await assert.rejects(listNotes, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'NETWORK');
    return true;
  });
});

test('非 JSON 的 200 响应视为 BAD_RESPONSE', async () => {
  mockFetch(() => new Response('<html>gateway</html>', { status: 200 }));
  await assert.rejects(listNotes, (error: unknown) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'BAD_RESPONSE');
    return true;
  });
});

test('createNote 发送 JSON 并解析 item', async () => {
  let received: { url: string; init?: RequestInit } | undefined;
  mockFetch((url, init) => {
    received = { url, init };
    return new Response(JSON.stringify({ item: { id: 2, content: '新留言', created_at: '2026-11-04T09:00:00.000Z' } }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  const data = await createNote('新留言');
  assert.equal(data.item.id, 2);
  assert.equal(received?.init?.method, 'POST');
  assert.equal(received?.init?.headers?.['Content-Type' as keyof HeadersInit], 'application/json');
  assert.deepEqual(JSON.parse(String(received?.init?.body)), { content: '新留言' });
});

test('deleteNote 使用 DELETE 与数字 id 路径', async () => {
  let receivedUrl = '';
  let receivedMethod = '';
  mockFetch((url, init) => {
    receivedUrl = url;
    receivedMethod = init?.method ?? 'GET';
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  await deleteNote(7);
  assert.equal(receivedUrl.endsWith('/api/notes/7'), true);
  assert.equal(receivedMethod, 'DELETE');
});
