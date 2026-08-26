import type { SolverMode, SolverProgress, SolverResult } from '../data/types';
import {
  activeMaskFromCounts,
  activeTraitCountFromCounts,
  buildCountsFromHeroes,
  emblemActivationUpperBound,
  evaluateBest,
  remainingCoverageUpperBound,
  resultIsBetter,
  totalCost,
  type SolverData,
} from './common';
import { greedySolve } from './greedy';
import { Runtime } from './runtime';

/**
 * Solver A：羁绊数量最大化（Max Traits）。
 * Phase 1 贪心 -> Phase 2 回溯分支定界 -> Phase 3 局部搜索（单英雄替换）。
 */
export async function solveMaxTraits(
  data: SolverData,
  onProgress: (p: SolverProgress) => void,
  isCancelled: () => boolean,
  timeLimitMs: number,
): Promise<SolverResult> {
  const mode: SolverMode = 'maxTraits';
  const runtime = new Runtime(timeLimitMs, isCancelled, onProgress);

  // Phase 1：贪心快速解
  let best = greedySolve(data, mode);
  runtime.report('greedy', 0.08, `贪心初始解：${best.activeTraits.length} 个羁绊`, best);

  // Phase 2：回溯分支定界
  best = await backtrackA(data, best, runtime);

  if (runtime.timedOut()) best = { ...best, timedOut: true, approximate: true };
  if (runtime.isCancelled()) return best;

  // Phase 3：局部搜索
  best = localSearchA(data, best, runtime);
  runtime.report('local', 0.98, '局部搜索完成', best);

  best = { ...best, timedOut: runtime.timedOut(), approximate: runtime.timedOut() };
  return best;
}

async function backtrackA(
  data: SolverData,
  initialBest: SolverResult,
  runtime: Runtime,
): Promise<SolverResult> {
  let best = initialBest;
  const n = data.candidates.length;
  const baseCounts = buildCountsFromHeroes(data.lockedHeroes, data);

  const dfs = async (
    start: number,
    counts: Uint8Array,
    used: number,
    selectedHeroes: (typeof data.candidates)[number][],
    fiveCost: number,
  ): Promise<void> => {
    await runtime.tick();
    if (runtime.shouldStop()) return;

    // 上界剪枝：当前激活数 + 剩余英雄潜在新增 + 转职潜在新增 + 拉克丝双倍裕量
    const activeCount = activeTraitCountFromCounts(counts, data.generalTraits);
    const activeMask = activeMaskFromCounts(counts, data.generalTraits);
    const remainingSlots = data.population - used;
    const heroPotential = remainingCoverageUpperBound(data, start, activeMask, remainingSlots);
    const emblemPotential = emblemActivationUpperBound(counts, data, activeMask);
    const luxSlack = data.luxAvailable ? 1 : 0;
    const upperBound = activeCount + heroPotential + emblemPotential + luxSlack;
    if (upperBound <= best.activeTraits.length) return;

    // 该节点有潜力，才做完整评估（含转职分配与拉克丝双倍自动选择）
    const result = evaluateBest(data, selectedHeroes, counts, 'maxTraits');
    if (resultIsBetter(best, result, 'maxTraits')) {
      best = result;
      runtime.report(
        'backtrack',
        0.1 + (start / Math.max(1, n)) * 0.8,
        `回溯找到更优解：${best.activeTraits.length} 个羁绊 / 费用 ${totalCost(best.heroes)}`,
        best,
      );
    }

    // 分支：按预处理顺序遍历，人口剪枝 + 对称剪枝
    for (let i = start; i < n; i += 1) {
      if (used + data.heroSlots[i] > data.population) continue;
      if (i > start && data.heroSignatures[i] === data.heroSignatures[i - 1]) continue;
      if (data.heroCosts[i] === 5 && fiveCost >= data.maxFiveCost) continue;

      const hero = data.candidates[i];
      for (const t of data.heroGeneralIndices[i]) counts[t] += 1;
      selectedHeroes.push(hero);

      await dfs(
        i + 1,
        counts,
        used + data.heroSlots[i],
        selectedHeroes,
        fiveCost + (data.heroCosts[i] === 5 ? 1 : 0),
      );

      selectedHeroes.pop();
      for (const t of data.heroGeneralIndices[i]) counts[t] -= 1;

      if (runtime.shouldStop()) return;
    }
  };

  await dfs(0, baseCounts, data.lockedSlots, [...data.lockedHeroes], 0);
  return best;
}

function localSearchA(data: SolverData, initial: SolverResult, runtime: Runtime): SolverResult {
  let current = initial;
  const lockedIds = new Set(data.lockedHeroes.map((h) => h.id));

  for (let round = 0; round < 3 && !runtime.shouldStop(); round += 1) {
    let improved = false;
    const freeSelected = current.heroes.filter((h) => !lockedIds.has(h.id));
    const selectedIds = new Set(current.heroes.map((h) => h.id));
    const outside = data.candidates.filter((c) => !selectedIds.has(c.id));

    outer: for (const inHero of freeSelected) {
      for (const outHero of outside) {
        if (runtime.shouldStop()) return current;
        const newHeroes = current.heroes.filter((h) => h.id !== inHero.id).concat(outHero);
        if (newHeroes.reduce((s, h) => s + h.slots, 0) > data.population) continue;
        const newFiveCost = newHeroes.filter((h) => !lockedIds.has(h.id) && h.cost === 5).length;
        if (newFiveCost > data.maxFiveCost) continue;

        const counts = buildCountsFromHeroes(newHeroes, data);
        const candidate = evaluateBest(data, newHeroes, counts, 'maxTraits');
        if (resultIsBetter(current, candidate, 'maxTraits')) {
          current = candidate;
          improved = true;
          break outer;
        }
      }
    }
    if (!improved) break;
  }

  return current;
}
