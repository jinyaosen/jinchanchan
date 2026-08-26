import type { Champion, SolverMode, SolverProgress, SolverResult } from '../data/types';
import {
  activeTraitCountFromCounts,
  buildCountsFromHeroes,
  evaluateBest,
  resultIsBetter,
  type SolverData,
} from './common';
import { greedySolve } from './greedy';
import { Runtime } from './runtime';
import { computeBonusScore, tierScoreForIndex, traitTierScore } from '../utils/scoring';

/**
 * Solver B：阵容质量最强（Max Quality）。
 * 目标函数 = 费用分 + 羁绊层级分 + 功能性加成。
 * 上界剪枝：当前质量下界 + 剩余人口 * 单位人口最大质量 + 转职/拉克丝/功能加成裕量。
 */
export async function solveMaxQuality(
  data: SolverData,
  onProgress: (p: SolverProgress) => void,
  isCancelled: () => boolean,
  timeLimitMs: number,
): Promise<SolverResult> {
  const mode: SolverMode = 'maxQuality';
  const runtime = new Runtime(timeLimitMs, isCancelled, onProgress);

  // Phase 1：贪心快速解
  let best = greedySolve(data, mode);
  runtime.report('greedy', 0.08, `贪心初始解：质量分 ${best.qualityScore ?? 0}`, best);

  // Phase 2：回溯分支定界
  best = await backtrackB(data, best, runtime);

  if (runtime.timedOut()) best = { ...best, timedOut: true, approximate: true };
  if (runtime.isCancelled()) return best;

  // Phase 3：局部搜索
  best = localSearchB(data, best, runtime);
  runtime.report('local', 0.98, '局部搜索完成', best);

  best = { ...best, timedOut: runtime.timedOut(), approximate: runtime.timedOut() };
  return best;
}

function maxQualityPerSlot(data: SolverData): number {
  let max = 0;
  for (let i = 0; i < data.candidates.length; i += 1) {
    const hero = data.candidates[i];
    let traitPotential = 0;
    for (const t of data.heroGeneralIndices[i]) {
      traitPotential += tierScoreForIndex(data.generalTraits[t].thresholds.length - 1);
    }
    const perSlot = (hero.cost * 10 + traitPotential) / hero.slots;
    if (perSlot > max) max = perSlot;
  }
  return max;
}

function currentQualityLowerBound(
  data: SolverData,
  heroes: Champion[],
  counts: Uint8Array,
  used: number,
): number {
  const costScore = heroes.reduce((s, h) => s + h.cost * 10, 0);
  let traitScore = 0;
  for (let i = 0; i < data.generalTraits.length; i += 1) {
    traitScore += traitTierScore(data.generalTraits[i].thresholds, counts[i]);
  }
  const activeCount = activeTraitCountFromCounts(counts, data.generalTraits);
  const bonus = computeBonusScore(heroes, activeCount, used, data.population);
  return costScore + traitScore + bonus;
}

async function backtrackB(
  data: SolverData,
  initialBest: SolverResult,
  runtime: Runtime,
): Promise<SolverResult> {
  let best = initialBest;
  const n = data.candidates.length;
  const baseCounts = buildCountsFromHeroes(data.lockedHeroes, data);
  const perSlotBound = maxQualityPerSlot(data);

  const dfs = async (
    start: number,
    counts: Uint8Array,
    used: number,
    selectedHeroes: Champion[],
    fiveCost: number,
  ): Promise<void> => {
    await runtime.tick();
    if (runtime.shouldStop()) return;

    const currentQuality = currentQualityLowerBound(data, selectedHeroes, counts, used);
    const remainingSlots = data.population - used;
    const emblemQualityPotential = data.selectedEmblemTotal * 120;
    const luxQualitySlack = data.luxAvailable ? 120 : 0;
    const upperBound =
      currentQuality +
      remainingSlots * perSlotBound +
      emblemQualityPotential +
      luxQualitySlack +
      70;
    if (upperBound <= (best.qualityScore ?? 0)) return;

    const result = evaluateBest(data, selectedHeroes, counts, 'maxQuality');
    if (resultIsBetter(best, result, 'maxQuality')) {
      best = result;
      runtime.report(
        'backtrack',
        0.1 + (start / Math.max(1, n)) * 0.8,
        `回溯找到更优解：质量分 ${best.qualityScore ?? 0}`,
        best,
      );
    }

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

function localSearchB(data: SolverData, initial: SolverResult, runtime: Runtime): SolverResult {
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
        const candidate = evaluateBest(data, newHeroes, counts, 'maxQuality');
        if (resultIsBetter(current, candidate, 'maxQuality')) {
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
