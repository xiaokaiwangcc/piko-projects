export interface HaidouMeta {
  gamePatch: string;
  dataDate: string;
  generatedAt: string;
  aliasUpdatedAt?: string;
}

export interface AugmentInfo {
  name: string;
  rarity: 'silver' | 'gold' | 'prismatic' | string;
  rarityName: string;
  desc: string;
}

export interface ChampionAugment {
  id: number;
  winRate: number;
  pickRate: number;
  games: number;
  rank: number;
}

export interface Combo {
  ids: number[];
  names: string[];
  winRate: number;
  games: number;
}

export interface LaterItem {
  ids: number[];
  pickRate: number;
  winRate: number;
  games: number;
}

export interface Build {
  key: string;
  label: string;
  items: number[];
  starters: number[][];
  boots: number[];
  bootsPickRate: number;
  later: LaterItem[];
  games: number;
  winRate: number;
  pickRate: number;
  skills: string[];
  spells: number[];
}

export interface Champion {
  id: number;
  name: string;
  alias: string;
  title: string;
  /** 常见中文外号，如 亚索 → 压缩 / 快乐风男 */
  aliases?: string[];
  /** 官方中文名全拼 */
  pinyin?: string;
  /** 官方中文名首字母 */
  pinyinInitials?: string;
  roles: string[];
  winRate: number;
  pickRate: number;
  tier: number;
  augments: ChampionAugment[];
  combos: Combo[];
  builds: Build[];
}

export interface ItemInfo {
  name: string;
}

export interface HaidouData {
  meta: HaidouMeta;
  spells: Record<string, string>;
  items: Record<string, ItemInfo>;
  augments: Record<string, AugmentInfo>;
  champions: Champion[];
}
