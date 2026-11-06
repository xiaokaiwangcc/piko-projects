/**
 * 由 worker/src/index.js 生成 Pages Functions advanced mode 的 _worker.js。
 *
 * 目的：让同一份接口实现同时服务两种部署形态
 *   1) 独立 Worker（workers.dev 直连 API）
 *   2) Pages 同源 API（/api/* 由 Pages 处理，其余交给静态资源）
 * 避免两处逻辑漂移。
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const srcPath = path.join(root, 'worker/src/index.js');
const outDir = path.join(root, 'web/public');
const outPath = path.join(outDir, '_worker.js');

const apiSource = await readFile(srcPath, 'utf8');
const marker = 'export default {';
const cut = apiSource.indexOf(marker);
if (cut === -1) {
  throw new Error(`${srcPath} 未找到 export default，无法生成 Pages worker`);
}

const body = apiSource.slice(0, cut).trimEnd();
const pagesWrapper = `

// ---- Pages 同源适配层（由 scripts/build-pages-worker.mjs 生成，勿手改）----
const STATIC_FALLBACK = () => new Response('Not Found', { status: 404 });

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === '/api' || pathname.startsWith('/api/') || pathname === '/mcp') {
      return handleRequest(request, env);
    }
    if (env.ASSETS?.fetch) {
      return env.ASSETS.fetch(request);
    }
    return STATIC_FALLBACK();
  },
};
`;

if (!body.includes('export async function handleRequest')) {
  throw new Error('handleRequest 未导出，Pages 适配层无法复用');
}

await mkdir(outDir, { recursive: true });
await writeFile(outPath, body + pagesWrapper);
console.log('pages worker generated:', outPath);
