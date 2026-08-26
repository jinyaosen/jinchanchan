import type { SolverMode, SolverResult } from '../data/types';
import {
  buildCountsFromHeroes,
  evaluateBest,
  resultIsBetter,
  type SolverData,
} from './common';

/**
 * 两套求解器共享的「贪心快速解」。
 * 采用 best-first 贪心：每次从未选英雄中挑一个使目标函数提升最大的加入，
 * 直到无法提升或人口已满。用于给回溯提供较好的初始下界，并立即展示近似解。
 */
export function greedySolve(data: SolverData, mode: SolverMode): SolverResult {
  let selectedIndices: number[] = [];
  let heroes = [...data.lockedHeroes];
  let counts = buildCountsFromHeroes(heroes, data);
  let used = data.lockedSlots;
  let best = evaluateBest(data, heroes, counts, mode, false, true);

  let improved = true;
  while (improved) {
    improved = false;
    let bestCandidate = best;
    let bestIndex = -1;
    let bestCounts = counts;

    for (let i = 0; i < data.candidates.length; i += 1) {
      if (selectedIndices.includes(i)) continue;
      if (used + data.heroSlots[i] > data.population) continue;

      const nextCounts = counts.slice();
      for (const t of data.heroGeneralIndices[i]) nextCounts[t] += 1;
      const nextHeroes = [...heroes, data.candidates[i]];
      const candidate = evaluateBest(data, nextHeroes, nextCounts, mode, false, true);

      if (resultIsBetter(bestCandidate, candidate, mode)) {
        bestCandidate = candidate;
        bestIndex = i;
        bestCounts = nextCounts;
      }
    }

    if (bestIndex >= 0 && resultIsBetter(best, bestCandidate, mode)) {
      selectedIndices.push(bestIndex);
      heroes = [...heroes, data.candidates[bestIndex]];
      counts = bestCounts;
      used += data.heroSlots[bestIndex];
      best = bestCandidate;
      improved = true;
    }
  }

  return best;
}
