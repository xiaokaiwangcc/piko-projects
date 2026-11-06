import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const dist = path.resolve(process.argv[2] ?? 'dist');
let html = await readFile(path.join(dist, 'index.html'), 'utf8');

const inlineTag = async (tag, re, kind) => {
  const m = html.match(re);
  if (!m) return;
  const rel = m[1].replace(/^\//, '');
  const file = path.join(dist, rel);
  let content = await readFile(file, 'utf8');
  if (kind === 'css') {
    html = html.replace(m[0], `<style>\n${content}\n</style>`);
  } else {
    // 转义会提前闭合 script 的序列，避免内联后 HTML 解析出错
    content = content.replace(/<\/script/gi, '<\\/script');
    html = html.replace(m[0], `<script type="module">\n${content}\n</script>`);
  }
};

await inlineTag('script', /<script[^>]+src="([^"]+)"[^>]*><\/script>/, 'js');
await inlineTag('link', /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"[^>]*>/, 'css');
await writeFile(path.join(dist, 'index.html'), html);
const files = await readdir(dist, { recursive: true });
console.log('inlined:', path.join(dist, 'index.html'), `${(html.length / 1024).toFixed(1)} KB`);
console.log('remaining files:', files.filter(f => !f.startsWith('assets')).join(', ') || '(assets still present, unused)');
