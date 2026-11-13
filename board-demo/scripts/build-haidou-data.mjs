/**
 * 生成 web/public/data/haidou.json（海斗助手静态数据快照）。
 *
 * 原始数据来自 LOLDAA 公开接口，抓取方式与字段说明见 README「海斗助手」一节。
 * 需要先把以下 4 份原始文件放到本机（路径可用环境变量覆盖）：
 *   RAW_CHAMPS   173 个英雄的 aramkit 数据合集（默认 ~/Downloads/aramkit-champions-all.json）
 *   RAW_CATALOG  aramkit catalog.json（强化说明）
 *   ITEM_JSON    Data Dragon 装备中文名（16.21.1）
 *   SPELL_JSON   Data Dragon 召唤师技能中文名（16.21.1）
 *
 * 用法：PATH=/opt/homebrew/bin:$PATH node scripts/build-haidou-data.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { CHAMPION_ALIASES } from './champion-aliases.mjs';

const HOME = process.env.HOME;
const RAW_CHAMPS = process.env.RAW_CHAMPS || path.join(HOME, 'Downloads/aramkit-champions-all.json');
const RAW_CATALOG = process.env.RAW_CATALOG || '/private/tmp/lol/aramkit-catalog.json';
const ITEM_JSON = process.env.ITEM_JSON || '/private/tmp/lol/ddragon-item-16.21.1.json';
const SPELL_JSON = process.env.SPELL_JSON || '/private/tmp/lol/ddragon-summoner-16.21.1.json';
const OUT = process.env.OUT || path.resolve('web/public/data/haidou.json');

// LOLDAA 装备池里出现、但 Data Dragon 16.21 中文包里查不到的条目（人工核对后补名）
const EXTRA_ITEM_NAMES = { 3086: '狂热' };

const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));

// RAW_BUNDLE：一次抓下来的 {index, files{...}} 合集（champions/*.json + catalog.json），
// 免去 173 次单独抓取。PREV_DATA：上一版 haidou.json，用于复用装备/召唤师技能中文名
// （Data Dragon 的 JSON 无法在离线环境重新下载）。
const BUNDLE = process.env.RAW_BUNDLE;
const PREV = process.env.PREV_DATA;
let champs, catalog, itemData = null, spells = {}, prevItems = null;
if (BUNDLE) {
  const bundle = read(BUNDLE);
  champs = Object.entries(bundle.files)
    .filter(([k]) => k.startsWith('champions/'))
    .map(([, v]) => v);
  catalog = new Map(bundle.files['catalog.json'].list.map((x) => [x.id, x]));
  const prev = PREV ? read(PREV) : null;
  if (!prev) throw new Error('RAW_BUNDLE 模式需要 PREV_DATA 提供装备/技能中文名');
  spells = prev.spells || {};
  prevItems = prev.items || {};
} else {
  champs = read(RAW_CHAMPS);
  catalog = new Map(read(RAW_CATALOG).list.map((x) => [x.id, x]));
  itemData = read(ITEM_JSON).data;
  const spellData = read(SPELL_JSON).data;
  for (const v of Object.values(spellData)) spells[v.key] = v.name;
}

const buildLabel = {
  ap: '法系', tank: '坦克', crit: '暴击', bruiser: '战士',
  lethality: '穿甲', on_hit: '普攻特效', utility: '功能', ad: '攻击', hybrid: '混伤',
};

const round = (n, d = 4) => Math.round(n * 10 ** d) / 10 ** d;

function topBy(list, score, n) {
  return [...list].sort((a, b) => score(b) - score(a)).slice(0, n);
}

const augmentsOut = new Map();
const itemsOut = new Map();

const champions = champs.map((c) => {
  const stats = c.champion.stats;
  const all = c.augments.map((a) => ({ ...a, stats: a.stats }));
  const byPick = topBy(all, (a) => a.stats.pickRate, 12);
  const byWin = topBy(all.filter((a) => a.stats.games >= 1000), (a) => a.stats.winRate, 6);
  const seen = new Set();
  const picked = [];
  for (const a of [...byWin, ...byPick]) {
    if (seen.has(a.id) || picked.length >= 14) continue;
    seen.add(a.id);
    const desc = catalog.get(a.id)?.description || '';
    augmentsOut.set(a.id, {
      name: a.name,
      rarity: a.rarityName,
      rarityName: a.rarityDisplayName,
      desc,
    });
    picked.push({
      id: a.id,
      winRate: round(a.stats.winRate),
      pickRate: round(a.stats.pickRate),
      games: a.stats.games,
      rank: a.stats.rank,
    });
  }

  const builds = c.builds.slice(0, 3).map((b) => {
    const boots = topBy(b.extras.filter((e) => e.kind === 'boots'), (e) => e.pickRate, 1)[0];
    const later = topBy(b.extras.filter((e) => e.kind === 'later'), (e) => e.pickRate, 3);
    const skill = topBy(b.skills || [], (s) => s.pickRate, 1)[0];
    const spell = topBy(b.spells || [], (s) => s.pickRate, 1)[0];
    for (const id of [...b.items, ...b.starters.flat(), ...(boots ? boots.ids : []), ...later.flatMap((e) => e.ids)]) {
      if (!itemsOut.has(id)) {
        const it = itemData ? itemData[id] : null;
        const prevIt = prevItems ? prevItems[id] : null;
        const name = it ? it.name : (prevIt ? prevIt.name : (EXTRA_ITEM_NAMES[id] || String(id)));
        itemsOut.set(id, { name });
      }
    }
    return {
      key: b.key,
      label: buildLabel[b.key] || b.label,
      items: b.items,
      starters: b.starters.slice(0, 2),
      boots: boots ? boots.ids : [],
      bootsPickRate: boots ? round(boots.pickRate) : 0,
      later: later.map((e) => ({ ids: e.ids, pickRate: round(e.pickRate), winRate: round(e.winRate), games: e.games })),
      games: b.games,
      winRate: round(b.winRate),
      pickRate: round(b.pickRate),
      skills: skill ? skill.skillKeys : [],
      spells: spell ? spell.ids : [],
    };
  });

  const combos = topBy(c.brackets.all.combos || [], (x) => (x.games >= 1000 ? x.winRate : x.winRate * 0.5), 3)
    .map((x) => ({
      ids: x.augmentIds,
      names: x.augmentIds.map((id) => augmentsOut.get(id)?.name || all.find((a) => a.id === id)?.name || String(id)),
      winRate: round(x.winRate),
      games: x.games,
    }));

  return {
    id: c.championId,
    name: c.name,
    alias: c.champion.alias || '',
    title: c.title,
    aliases: CHAMPION_ALIASES[c.championId]?.aliases || [],
    pinyin: CHAMPION_ALIASES[c.championId]?.py || '',
    pinyinInitials: CHAMPION_ALIASES[c.championId]?.pyi || '',
    roles: c.roles,
    winRate: round(stats.winRate),
    pickRate: round(stats.pickRate),
    tier: stats.tier,
    augments: picked,
    combos,
    builds,
  };
});

const meta = {
  gamePatch: champs[0].dataVersion,
  dataDate: champs[0].champion.stats.date,
  generatedAt: new Date().toISOString(),
};

const out = { meta, spells, items: Object.fromEntries(itemsOut), augments: Object.fromEntries(augmentsOut), champions };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));
console.log(JSON.stringify({ out: OUT, bytes: fs.statSync(OUT).size, champions: champions.length, items: itemsOut.size, augments: augmentsOut.size, patch: meta.gamePatch, date: meta.dataDate }, null, 2));
