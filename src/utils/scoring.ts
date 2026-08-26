import type { Champion, Trait } from '../data/types';

/**
 * 评分与阈值查询工具。
 * 质量分 = 英雄费用分 + 羁绊层级分 + 功能性加成。
 */

// 每达到一级 threshold 的累计层级分（提示词规定：15/35/60/90/120，逐级累计）
const TIER_SCORES = [15, 35, 60, 90, 120];

/** 达到第 k 级 threshold 时的累计层级分；k 为 -1 表示未激活 */
export function tierScoreForIndex(k: number): number {
  if (k < 0) return 0;
  let sum = 0;
  for (let i = 0; i <= k && i < TIER_SCORES.length; i += 1) {
    sum += TIER_SCORES[i];
  }
  return sum;
}

/** 返回当前计数达到的最高 threshold 索引，未激活返回 -1 */
export function highestTierIndex(thresholds: number[], count: number): number {
  let idx = -1;
  for (let i = 0; i < thresholds.length; i += 1) {
    if (count >= thresholds[i]) idx = i;
    else break;
  }
  return idx;
}

/** 某羁绊在当前计数下的层级分 */
export function traitTierScore(thresholds: number[], count: number): number {
  return tierScoreForIndex(highestTierIndex(thresholds, count));
}

/** 计数从 oldCount 升到 newCount 带来的层级分增量 */
export function traitTierScoreDelta(thresholds: number[], oldCount: number, newCount: number): number {
  return traitTierScore(thresholds, newCount) - traitTierScore(thresholds, oldCount);
}

/** 英雄费用分：cost * 10 */
export function computeCostScore(heroes: Champion[]): number {
  return heroes.reduce((sum, h) => sum + h.cost * 10, 0);
}

/** 羁绊层级分：所有激活 general 羁绊的层级分之和 */
export function computeTraitScore(
  generalTraits: Trait[],
  traitCounts: Record<string, number>,
): number {
  let score = 0;
  for (const trait of generalTraits) {
    const count = traitCounts[trait.name] ?? 0;
    score += traitTierScore(trait.thresholds, count);
  }
  return score;
}

/** 功能性加成（模式 B） */
export function computeBonusScore(
  heroes: Champion[],
  activeTraitCount: number,
  usedPopulation: number,
  population: number,
): number {
  let score = 0;
  if (heroes.some((h) => h.cost >= 5)) score += 20;
  if (heroes.filter((h) => h.cost >= 4).length >= 3) score += 15;
  if (activeTraitCount >= 8) score += 25;
  if (population > 0 && usedPopulation / population >= 0.9) score += 10;
  return score;
}

export interface QualityScores {
  costScore: number;
  traitScore: number;
  bonusScore: number;
  total: number;
}

/** 计算完整质量分及各分项明细 */
export function computeQualityScores(
  heroes: Champion[],
  generalTraits: Trait[],
  traitCounts: Record<string, number>,
  activeTraitCount: number,
  usedPopulation: number,
  population: number,
): QualityScores {
  const costScore = computeCostScore(heroes);
  const traitScore = computeTraitScore(generalTraits, traitCounts);
  const bonusScore = computeBonusScore(heroes, activeTraitCount, usedPopulation, population);
  return { costScore, traitScore, bonusScore, total: costScore + traitScore + bonusScore };
}
