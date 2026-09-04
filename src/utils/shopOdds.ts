/**
 * 商店概率与费用曲线。
 * 运营规划按「棋盘人口 = 等级」自动映射等级，等级 >10 时按 10 级处理；
 * 费用曲线用于限制每档优先考虑的卡池，第一优先级仍是凑更多羁绊。
 */

export const SHOP_ODDS: Readonly<Record<number, readonly [number, number, number, number, number]>> = {
  2: [100, 0, 0, 0, 0],
  3: [75, 25, 0, 0, 0],
  4: [55, 30, 15, 0, 0],
  5: [45, 33, 20, 2, 0],
  6: [30, 40, 25, 5, 0],
  7: [19, 30, 40, 10, 1],
  8: [15, 20, 32, 30, 3],
  9: [10, 17, 25, 33, 15],
  10: [5, 10, 20, 40, 25],
};

/**
 * 按商店概率的经验规则：
 * 6 级及以下主要 1-2 费；7 级可较多使用 3 费；8 级后可用 4 费；9 级后自由使用 5 费。
 */
export const MAX_COST_BY_LEVEL: Readonly<Record<number, number>> = {
  2: 1,
  3: 2,
  4: 2,
  5: 2,
  6: 2,
  7: 3,
  8: 4,
  9: 5,
  10: 5,
};

export function levelForPopulation(population: number): number {
  return Math.min(10, Math.max(2, Math.floor(population)));
}

export function maxCostForPopulation(population: number): number {
  return MAX_COST_BY_LEVEL[levelForPopulation(population)] ?? 5;
}
