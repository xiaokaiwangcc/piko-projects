/**
 * 把 scripts/champion-aliases.mjs 的别称 / 拼音合并进现有 haidou.json。
 * 已存在则覆盖 aliases / pinyin / pinyinInitials，可重复执行。
 *
 * 用法：PATH=/opt/homebrew/bin:$PATH node scripts/apply-champion-aliases.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { CHAMPION_ALIASES } from './champion-aliases.mjs';

const OUT = path.resolve('web/public/data/haidou.json');
const data = JSON.parse(fs.readFileSync(OUT, 'utf8'));

let applied = 0;
const missing = [];
for (const champion of data.champions) {
  const entry = CHAMPION_ALIASES[champion.id];
  if (!entry) {
    missing.push(champion.name);
    continue;
  }
  champion.aliases = entry.aliases;
  champion.pinyin = entry.py;
  champion.pinyinInitials = entry.pyi;
  applied += 1;
}

const unknown = Object.keys(CHAMPION_ALIASES).filter(
  (id) => !data.champions.some((champion) => champion.id === Number(id)),
);

if (unknown.length) throw new Error(`别名表里有不存在的英雄 id：${unknown.join(', ')}`);
if (missing.length) throw new Error(`这些英雄还没有别名：${missing.join(', ')}`);

data.meta.aliasUpdatedAt = new Date().toISOString();
fs.writeFileSync(OUT, JSON.stringify(data));
console.log(`aliases applied: ${applied} champions -> ${OUT}`);
