/**
 * 人口 -> 英雄费用曲线。
 * 低人口尽量使用低费英雄，8 人口开始允许少量 5 费，9 人口起大量 5 费，
 * 10 人口以上基本只用 4/5 费。锁定英雄（明确选择）不受该曲线限制。
 */
export interface CostPolicy {
  /** 非锁定英雄允许的最低费用 */
  minCost: number;
  /** 非锁定英雄允许的最高费用 */
  maxCost: number;
  /** 非锁定英雄中 5 费英雄的最大数量，Infinity 表示不限制 */
  maxFiveCost: number;
}

export function getCostPolicy(population: number): CostPolicy {
  if (population <= 4) return { minCost: 1, maxCost: 2, maxFiveCost: 0 };
  if (population <= 7) return { minCost: 1, maxCost: 3, maxFiveCost: 0 };
  if (population === 8) return { minCost: 1, maxCost: 5, maxFiveCost: 1 };
  if (population === 9) return { minCost: 3, maxCost: 5, maxFiveCost: 4 };
  return { minCost: 4, maxCost: 5, maxFiveCost: Number.POSITIVE_INFINITY };
}
