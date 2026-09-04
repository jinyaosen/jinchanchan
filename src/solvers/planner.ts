import type {
  Champion,
  GameConfig,
  HeroChange,
  PlanProgress,
  PopulationPlan,
  PopulationStep,
  SolverResult,
  Trait,
} from '../data/types';
import { levelForPopulation, maxCostForPopulation } from '../utils/shopOdds';
import {
  KHAZIX_EVOLVE_TRAITS,
  khazixEvolvedTraitCount,
  khazixKillsThreshold,
} from '../utils/khazix';
import {
  buildCountsFromHeroes,
  evaluateBest,
  prepareSolverData,
  totalCost,
  type SolverData,
} from './common';

/**
 * 运营规划：从起始人口逐档推进到目标人口，每档给出阵容与相对上一档的
 * 新增/替换/移除。低人口阶段用低费卡凑羁绊，随人口提升逐步解锁高费卡。
 *
 * 目标函数：先追求激活更多 general 羁绊，再在同羁绊数下按人口分阶段调整费用偏好：
 *  - 4~6 人口：低费卡凑羁绊，同羁绊数下偏好更低总费用；
 *  - 7 人口及以后：重开阵容并偏好更高总费用，保证中期强度。
 * 费用曲线只限制每档优先考虑的卡池（不强行牺牲羁绊数量）。
 */

function planResultIsBetter(
  a: SolverResult | null,
  b: SolverResult,
  preferHigherCost: boolean,
): boolean {
  if (a === null) return true;
  if (b.activeTraits.length !== a.activeTraits.length) {
    return b.activeTraits.length > a.activeTraits.length;
  }
  if (totalCost(b.heroes) !== totalCost(a.heroes)) {
    return preferHigherCost
      ? totalCost(b.heroes) > totalCost(a.heroes)
      : totalCost(b.heroes) < totalCost(a.heroes);
  }
  return b.usedPopulation > a.usedPopulation;
}

function sharedTraitCount(a: Champion, b: Champion): number {
  const set = new Set(a.traits);
  let count = 0;
  for (const t of b.traits) {
    if (set.has(t)) count += 1;
  }
  return count;
}

function computeChanges(prevHeroes: Champion[], currentHeroes: Champion[]): HeroChange {
  const prevIds = new Set(prevHeroes.map((h) => h.id));
  const currentIds = new Set(currentHeroes.map((h) => h.id));

  const removedRemaining = prevHeroes.filter((h) => !currentIds.has(h.id));
  const addedRemaining = currentHeroes.filter((h) => !prevIds.has(h.id));
  const replacements: { out: Champion; in: Champion }[] = [];

  // 将移除与新增按共享羁绊数量贪心配对，形成「替换 X -> Y」提示。
  while (removedRemaining.length > 0 && addedRemaining.length > 0) {
    let bestOut = removedRemaining[0];
    let bestIn = addedRemaining[0];
    let bestScore = -1;
    for (const out of removedRemaining) {
      for (const inn of addedRemaining) {
        const score = sharedTraitCount(out, inn);
        if (score > bestScore) {
          bestScore = score;
          bestOut = out;
          bestIn = inn;
        }
      }
    }
    replacements.push({ out: bestOut, in: bestIn });
    removedRemaining.splice(removedRemaining.indexOf(bestOut), 1);
    addedRemaining.splice(addedRemaining.indexOf(bestIn), 1);
  }

  return { added: addedRemaining, removed: removedRemaining, replacements };
}

function greedyFill(
  data: SolverData,
  seedHeroes: Champion[],
  maxCost: number,
  preferHigherCost: boolean,
): Champion[] {
  let heroes = [...seedHeroes];
  let counts = buildCountsFromHeroes(heroes, data);
  let used = heroes.reduce((s, h) => s + h.slots, 0);

  let improved = true;
  while (improved && used < data.population) {
    improved = false;
    let bestHero: Champion | null = null;
    let bestResult: SolverResult | null = null;
    let bestCounts = counts;

    for (let i = 0; i < data.candidates.length; i += 1) {
      const candidate = data.candidates[i];
      if (candidate.cost > maxCost) continue;
      if (used + data.heroSlots[i] > data.population) continue;
      if (heroes.some((h) => h.id === candidate.id)) continue;

      const nextCounts = counts.slice();
      for (const t of data.heroGeneralIndices[i]) nextCounts[t] += 1;

      const candidateResult = evaluateBest(data, [...heroes, candidate], nextCounts);
      if (planResultIsBetter(bestResult, candidateResult, preferHigherCost)) {
        bestResult = candidateResult;
        bestHero = candidate;
        bestCounts = nextCounts;
      }
    }

    if (bestHero) {
      heroes = [...heroes, bestHero];
      counts = bestCounts;
      used += bestHero.slots;
      improved = true;
    }
  }

  return heroes;
}

function localSwap(
  data: SolverData,
  heroes: Champion[],
  maxCost: number,
  preferHigherCost: boolean,
): Champion[] {
  const lockedIds = new Set(data.lockedHeroes.map((h) => h.id));
  let current = heroes;

  for (let round = 0; round < 2; round += 1) {
    let improved = false;
    const selectedIds = new Set(current.map((h) => h.id));
    const outside = data.candidates.filter((c) => !selectedIds.has(c.id) && c.cost <= maxCost);
    let currentResult = evaluateBest(data, current, buildCountsFromHeroes(current, data));

    outer: for (const inHero of current) {
      if (lockedIds.has(inHero.id)) continue;
      for (const outHero of outside) {
        if (outHero.id === inHero.id) continue;
        const newHeroes = current.filter((h) => h.id !== inHero.id).concat(outHero);
        if (newHeroes.reduce((s, h) => s + h.slots, 0) > data.population) continue;

        const candidate = evaluateBest(data, newHeroes, buildCountsFromHeroes(newHeroes, data));
        if (planResultIsBetter(currentResult, candidate, preferHigherCost)) {
          current = newHeroes;
          currentResult = candidate;
          improved = true;
          break outer;
        }
      }
    }

    if (!improved) break;
  }

  return current;
}

export async function buildPopulationPlan(
  champions: Champion[],
  traits: Trait[],
  config: GameConfig,
  onProgress: (p: PlanProgress) => void,
  isCancelled: () => boolean,
): Promise<PopulationPlan> {
  const base = prepareSolverData(champions, traits, config);
  const startPopulation = Math.max(4, base.lockedSlots);
  const targetPopulation = config.population;

  if (targetPopulation < startPopulation) {
    return { startPopulation, targetPopulation, steps: [] };
  }

  const steps: PopulationStep[] = [];
  let prevHeroes: Champion[] = [];
  let evolvedTraits: string[] = [];
  const totalSteps = targetPopulation - startPopulation + 1;

  const solveStep = (
    population: number,
    maxCost: number,
    khazixTraits: string[],
    prev: Champion[],
    seedFromPrev: boolean,
  ): { result: SolverResult; heroes: Champion[] } => {
    const stepConfig = { ...config, population, khazixEvolvedTraits: khazixTraits };
    const data = prepareSolverData(champions, traits, stepConfig);
    const lockedIds = new Set(data.lockedHeroes.map((h) => h.id));
    const seedHeroes: Champion[] = [...data.lockedHeroes];
    if (seedFromPrev) {
      for (const hero of prev) {
        if (lockedIds.has(hero.id)) continue;
        const candidate = data.candidates.find((c) => c.id === hero.id);
        if (candidate) seedHeroes.push(candidate);
      }
    }

    const preferHigherCost = population >= 7;
    let heroes = greedyFill(data, seedHeroes, maxCost, preferHigherCost);
    heroes = localSwap(data, heroes, maxCost, preferHigherCost);
    const result = evaluateBest(data, heroes, buildCountsFromHeroes(heroes, data));
    return { result, heroes: result.heroes };
  };

  for (let population = startPopulation; population <= targetPopulation; population += 1) {
    if (isCancelled()) break;

    const maxCost = maxCostForPopulation(population);
    const level = levelForPopulation(population);
    const targetEvolutions = config.includeKhazix ? khazixEvolvedTraitCount(population) : 0;
    // 7 人口时重开一次：此时 3 费卡大量出现，仅从锁定英雄重建强阵容，后续在此基础上继续。
    const seedFromPrev = population !== 7;
    const preferHigherCost = population >= 7;

    // 随人口提升，卡兹克击杀数达到 8/30/60/100 时依次新增进化羁绊。
    while (evolvedTraits.length < targetEvolutions) {
      const options = [...KHAZIX_EVOLVE_TRAITS].filter((t) => !evolvedTraits.includes(t));
      if (options.length === 0) break;

      let bestTrait: string | null = null;
      let bestResult: SolverResult | null = null;
      for (const option of options) {
        const trial = [...evolvedTraits, option];
        const solved = solveStep(population, maxCost, trial, prevHeroes, seedFromPrev);
        if (planResultIsBetter(bestResult, solved.result, preferHigherCost)) {
          bestResult = solved.result;
          bestTrait = option;
        }
      }

      if (!bestTrait) break;
      evolvedTraits = [...evolvedTraits, bestTrait];
    }

    const solved = solveStep(population, maxCost, evolvedTraits, prevHeroes, seedFromPrev);
    const changes = computeChanges(prevHeroes, solved.heroes);
    const khazixEvolutions = config.includeKhazix
      ? {
          count: evolvedTraits.length,
          traits: [...evolvedTraits],
          killsThreshold: khazixKillsThreshold(evolvedTraits.length),
        }
      : undefined;

    steps.push({
      population,
      level,
      maxCost,
      result: solved.result,
      changes,
      khazixEvolutions,
    });

    onProgress({
      step: population - startPopulation + 1,
      totalSteps,
      progress: (population - startPopulation + 1) / totalSteps,
      message: `已生成 ${population} 人口阵容`,
    });

    prevHeroes = solved.heroes;

    // 让出事件循环，允许 Worker 处理 cancel 消息。
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }

  return { startPopulation, targetPopulation, steps };
}
