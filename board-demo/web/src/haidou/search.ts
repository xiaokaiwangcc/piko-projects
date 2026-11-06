import type { Champion } from './types';

export interface SearchHit {
  champion: Champion;
  score: number;
  /** 命中原因的展示文本，如「俗称 压缩」「拼音 yasuo」 */
  label?: string;
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\s'’·•."()（）\-_/]/g, '');

function scoreOne(champion: Champion, rawQuery: string): SearchHit | null {
  const q = normalize(rawQuery);
  if (!q) return null;

  const name = normalize(champion.name);
  if (name === q) return { champion, score: 1000 };
  if (name.startsWith(q)) return { champion, score: 920 };
  if (name.includes(q)) return { champion, score: 760 };

  if (champion.alias && normalize(champion.alias) === q) return { champion, score: 900 };
  if (champion.alias && normalize(champion.alias).startsWith(q))
    return { champion, score: 860 };

  const alias = champion.aliases?.find((item) => normalize(item) === q);
  if (alias) return { champion, score: 890, label: `俗称 ${alias}` };

  const aliasPrefix = champion.aliases?.find((item) => normalize(item).startsWith(q));
  if (aliasPrefix) return { champion, score: 830, label: `俗称 ${aliasPrefix}` };

  if (champion.pinyin && champion.pinyin === q)
    return { champion, score: 880, label: `拼音 ${champion.pinyin}` };
  if (champion.pinyin && champion.pinyin.startsWith(q))
    return { champion, score: 850, label: `拼音 ${champion.pinyin}` };
  if (champion.pinyinInitials && champion.pinyinInitials === q)
    return { champion, score: 840, label: `首字母 ${champion.pinyinInitials.toUpperCase()}` };

  const title = normalize(champion.title);
  if (title === q) return { champion, score: 820, label: `称号 ${champion.title}` };
  if (title.includes(q)) return { champion, score: 500, label: `称号 ${champion.title}` };

  const aliasContains = champion.aliases?.find((item) => normalize(item).includes(q));
  if (aliasContains) return { champion, score: 480, label: `俗称 ${aliasContains}` };

  if (champion.pinyin && champion.pinyin.includes(q))
    return { champion, score: 430, label: `拼音 ${champion.pinyin}` };
  if (champion.pinyinInitials?.startsWith(q))
    return { champion, score: 420, label: `首字母 ${champion.pinyinInitials.toUpperCase()}` };

  return null;
}

export function matchChampion(champion: Champion, query: string): SearchHit | null {
  return scoreOne(champion, query);
}

export function searchChampions(
  champions: Champion[],
  query: string,
  limit = 8,
): SearchHit[] {
  return champions
    .map((champion) => scoreOne(champion, query))
    .filter((hit): hit is SearchHit => hit !== null)
    .sort((a, b) => b.score - a.score || b.champion.winRate - a.champion.winRate)
    .slice(0, limit);
}
