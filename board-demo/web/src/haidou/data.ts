import type { HaidouData } from './types';

export async function loadHaidouData(signal?: AbortSignal): Promise<HaidouData> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/haidou.json`, { signal });
  if (!response.ok) {
    throw new Error(`数据加载失败（HTTP ${response.status}）`);
  }
  return (await response.json()) as HaidouData;
}

export const ROLE_LABELS: Record<string, string> = {
  fighter: '战士',
  tank: '坦克',
  mage: '法师',
  marksman: '射手',
  assassin: '刺客',
  support: '辅助',
};

export const TIER_LABELS: Record<number, string> = {
  1: '夯',
  2: '顶级',
  3: '人上人',
  4: 'NPC',
  5: '拉满了',
};

export function pct(value: number, digits = 1): string {
  return `${(value * 100).toFixed(digits)}%`;
}

export function gameCount(value: number): string {
  if (value >= 10000) {
    const n = value / 10000;
    return `${n >= 10 ? n.toFixed(0) : n.toFixed(1)} 万场`;
  }
  return `${value.toLocaleString('zh-CN')} 场`;
}

export function championIcon(id: number): string {
  return `https://loldaa.com/img/champions/${id}.png`;
}

export function itemIcon(id: number): string {
  return `https://loldaa.com/img/items/${id}.png`;
}

export function augmentIcon(id: number): string {
  return `https://loldaa.com/img/augments/${id}.png`;
}
