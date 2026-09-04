import type { Champion } from '../data/types';

/**
 * 卡兹克「宿敌」进化特效处理。
 * 卡兹克自带「宿敌」羁绊（计入羁绊数量）；参与击杀后，可永久获得
 * 裁决使 / 迅捷射手 / 狂战士 / 法师 中任一项羁绊。
 */

export const KHAZIX_ID = 'khazix';
export const KHAZIX_NAME = '卡兹克';
export const KHAZIX_EVOLVE_TRAITS = ['裁决使', '迅捷射手', '狂战士', '法师'] as const;

/** 卡兹克参与击杀触发进化的击杀数阈值（依次获得 1/2/3/4 个进化羁绊） */
export const KHAZIX_EVOLUTION_THRESHOLDS = [8, 30, 60, 100] as const;

/**
 * 运营规划中按人口估算卡兹克已进化的羁绊数量。
 * 8 击杀较易（第 1 层），30/60/100 逐级更难，放在更靠后的人口档。
 */
export const KHAZIX_EVOLVED_COUNT_BY_POPULATION: Readonly<Record<number, number>> = {
  4: 0,
  5: 1,
  6: 1,
  7: 2,
  8: 2,
  9: 3,
  10: 3,
  11: 4,
};

export function khazixEvolvedTraitCount(population: number): number {
  const clamped = Math.max(0, Math.min(11, Math.floor(population)));
  return KHAZIX_EVOLVED_COUNT_BY_POPULATION[clamped] ?? 0;
}

export function khazixKillsThreshold(count: number): number | null {
  if (count <= 0 || count > KHAZIX_EVOLUTION_THRESHOLDS.length) return null;
  return KHAZIX_EVOLUTION_THRESHOLDS[count - 1];
}

/** 找到卡兹克（优先 id，兼容 name） */
export function findKhazix(champions: Champion[]): Champion | undefined {
  return champions.find((c) => c.id === KHAZIX_ID || c.name === KHAZIX_NAME);
}
