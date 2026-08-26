import type { Champion, GameConfig, SolverMode, SolverResult, Trait } from '../data/types';
import { encodeTraits, maskOf, popcount } from '../utils/bitmask';
import { getCostPolicy } from '../utils/costPolicy';
import { computeQualityScores } from '../utils/scoring';
import { findLux, getLuxDoubleTargets, isLux } from '../utils/luxEffect';

/**
 * 求解器共享逻辑：数据预处理、羁绊计数、转职分配、结果组装。
 * 关键设计：
 *  - general 羁绊使用固定索引，计数用 Uint8Array 追踪；
 *  - 英雄羁绊集合用 BigInt 位掩码编码，供剪枝使用；
 *  - 拉克丝双倍效果在「叶子节点」评估时才叠加到计数上。
 */

export interface SolverData {
  population: number;
  emblemCount: number;
  config: GameConfig;
  traits: Trait[];
  generalTraits: Trait[];
  /** general 羁绊名 -> 索引 */
  traitIndex: Map<string, number>;
  traitByName: Map<string, Trait>;
  lockedHeroes: Champion[];
  lockedSlots: number;
  remainingPopulation: number;
  candidates: Champion[];
  lux: Champion | null;
  /** 拉克丝是否实际可用（位于锁定或候选列表中） */
  luxAvailable: boolean;
  /** 可被拉克丝双倍的 general 羁绊名列表 */
  luxDoubleTargets: string[];
  /** 每个 general 羁绊索引对应的纹章数量（来自用户选择） */
  emblemCounts: Uint8Array;
  /** 已选择的纹章总数 */
  selectedEmblemTotal: number;
  /** 非锁定英雄中 5 费英雄的最大数量（Infinity 表示不限制） */
  maxFiveCost: number;
  heroGeneralIndices: number[][];
  heroMasks: bigint[];
  heroSlots: Uint8Array;
  heroCosts: Uint8Array;
  heroSignatures: string[];
}

export function prepareSolverData(
  champions: Champion[],
  traits: Trait[],
  config: GameConfig,
  mode: SolverMode = 'maxTraits',
): SolverData {
  const traitByName = new Map(traits.map((t) => [t.name, t]));
  const generalTraits = traits.filter((t) => t.type === 'general');
  const traitIndex = new Map(generalTraits.map((t, i) => [t.name, i]));

  const locked = new Set(config.lockedHeroIds);
  const policy = getCostPolicy(config.population);
  // 「羁绊最多」只追求羁绊数量，允许低费卡；「质量最强」才应用费用曲线。
  const enforceCostPolicy = mode === 'maxQuality';

  const lockedHeroes = champions.filter((c) => locked.has(c.id));
  const lockedSlots = lockedHeroes.reduce((s, c) => s + c.slots, 0);

  const candidates = champions
    .filter((c) => !locked.has(c.id))
    .filter((c) => !enforceCostPolicy || (c.cost >= policy.minCost && c.cost <= policy.maxCost))
    .map((c) => {
      const generalIndices = c.traits
        .filter((name) => traitIndex.has(name))
        .map((name) => traitIndex.get(name)!);
      return { champion: c, generalIndices };
    })
    .sort((a, b) => {
      const da = a.generalIndices.length / a.champion.slots;
      const db = b.generalIndices.length / b.champion.slots;
      if (db !== da) return db - da;
      if (b.champion.cost !== a.champion.cost) return b.champion.cost - a.champion.cost;
      return a.champion.id.localeCompare(b.champion.id);
    });

  const heroGeneralIndices = candidates.map((c) => c.generalIndices);
  const heroMasks = heroGeneralIndices.map((idx) => encodeTraits(idx));
  const heroSlots = Uint8Array.from(candidates.map((c) => c.champion.slots));
  const heroCosts = Uint8Array.from(candidates.map((c) => c.champion.cost));
  const heroSignatures = candidates.map((c) => {
    const base = `${c.champion.cost}|${[...c.generalIndices].sort((x, y) => x - y).join(',')}`;
    // 拉克丝的大元素使双倍效果会改变目标函数，不能与其它「无 general 羁绊」英雄做对称剪枝。
    return isLux(c.champion) ? `${base}|lux` : base;
  });

  const lux = findLux(champions);
  const luxAvailable = lux
    ? lockedHeroes.some((c) => c.id === lux.id) ||
      candidates.some((c) => c.champion.id === lux.id)
    : false;
  const luxDoubleTargets = getLuxDoubleTargets(traits, champions).filter((name) =>
    traitIndex.has(name),
  );

  // 根据用户选择的纹章数量构建每个 general 羁绊的纹章计数。
  const emblemCounts = new Uint8Array(generalTraits.length);
  let selectedEmblemTotal = 0;
  for (const [name, qty] of Object.entries(config.emblemChoices)) {
    const idx = traitIndex.get(name);
    if (idx === undefined || qty <= 0) continue;
    const capped = Math.min(Math.floor(qty), 255);
    emblemCounts[idx] = capped;
    selectedEmblemTotal += capped;
  }

  return {
    population: config.population,
    emblemCount: config.emblemCount,
    config,
    traits,
    generalTraits,
    traitIndex,
    traitByName,
    lockedHeroes,
    lockedSlots,
    remainingPopulation: config.population - lockedSlots,
    candidates: candidates.map((c) => c.champion),
    lux: lux ?? null,
    luxAvailable,
    luxDoubleTargets,
    emblemCounts,
    selectedEmblemTotal,
    maxFiveCost: enforceCostPolicy ? policy.maxFiveCost : Number.POSITIVE_INFINITY,
    heroGeneralIndices,
    heroMasks,
    heroSlots,
    heroCosts,
    heroSignatures,
  };
}

export function createEmptyCounts(data: SolverData): Uint8Array {
  return new Uint8Array(data.generalTraits.length);
}

/** 从英雄列表构建基础 general 计数（不含拉克丝双倍与转职） */
export function buildCountsFromHeroes(heroes: Champion[], data: SolverData): Uint8Array {
  const counts = createEmptyCounts(data);
  for (const hero of heroes) {
    for (const name of hero.traits) {
      const idx = data.traitIndex.get(name);
      if (idx !== undefined) counts[idx] += 1;
    }
  }
  return counts;
}

/** 统计激活的 general 羁绊数量（去重，只按最低阈值判断是否激活） */
export function activeTraitCountFromCounts(counts: Uint8Array, generalTraits: Trait[]): number {
  let active = 0;
  for (let i = 0; i < generalTraits.length; i += 1) {
    const thresholds = generalTraits[i].thresholds;
    if (thresholds.length > 0 && counts[i] >= thresholds[0]) active += 1;
  }
  return active;
}

/** 判断某个 general 羁绊是否激活 */
export function isTraitActive(trait: Trait, count: number): boolean {
  return trait.thresholds.length > 0 && count >= trait.thresholds[0];
}

/** 返回当前激活的 general 羁绊位掩码 */
export function activeMaskFromCounts(counts: Uint8Array, generalTraits: Trait[]): bigint {
  let mask = 0n;
  for (let i = 0; i < generalTraits.length; i += 1) {
    const thresholds = generalTraits[i].thresholds;
    if (thresholds.length > 0 && counts[i] >= thresholds[0]) mask |= maskOf(i);
  }
  return mask;
}

/** 将用户选择的固定纹章数量叠加到羁绊计数上（返回新数组，不修改原数组） */
export function applyEmblems(counts: Uint8Array, emblemCounts: Uint8Array): Uint8Array {
  const next = counts.slice();
  for (let i = 0; i < emblemCounts.length; i += 1) {
    next[i] += emblemCounts[i];
  }
  return next;
}

/** 若拉克丝在阵容中且指定双倍羁绊，则对该羁绊计数贡献 +2（返回新数组，不修改原数组） */
export function applyLuxDouble(
  counts: Uint8Array,
  data: SolverData,
  luxSelected: boolean,
  luxDoubleTrait: string | null,
): Uint8Array {
  const next = counts.slice();
  if (!luxSelected || !luxDoubleTrait || luxDoubleTrait === '') return next;
  const idx = data.traitIndex.get(luxDoubleTrait);
  if (idx !== undefined) next[idx] += 2;
  return next;
}

export interface FinalizeInput {
  data: SolverData;
  heroes: Champion[];
  baseCounts: Uint8Array;
  luxDoubleTrait: string | null;
  mode: SolverMode;
  timedOut: boolean;
  approximate: boolean;
}

/** 将求解中间状态组装为完整的 SolverResult */
export function finalizeResult(input: FinalizeInput): SolverResult {
  const { data, heroes, baseCounts, luxDoubleTrait, mode, timedOut, approximate } = input;
  const luxSelected = heroes.some((h) => isLux(h));
  const doubled = applyLuxDouble(baseCounts, data, luxSelected, luxDoubleTrait);

  // 叠加用户选择的纹章，得到最终计数
  const finalCounts = applyEmblems(doubled, data.emblemCounts);

  const usedPopulation = heroes.reduce((s, h) => s + h.slots, 0);
  const emblemUsed = data.selectedEmblemTotal;

  // 全羁绊计数（general 用 finalCounts，exclusive 直接数英雄）
  const traitCounts: Record<string, number> = {};
  for (const trait of data.traits) {
    if (trait.type === 'general') {
      const idx = data.traitIndex.get(trait.name);
      traitCounts[trait.name] = idx === undefined ? 0 : finalCounts[idx];
    } else {
      traitCounts[trait.name] = heroes.filter((h) => h.traits.includes(trait.name)).length;
    }
  }

  const emblemAllocations: Record<string, number> = {};
  for (let i = 0; i < data.generalTraits.length; i += 1) {
    if (data.emblemCounts[i] > 0) emblemAllocations[data.generalTraits[i].name] = data.emblemCounts[i];
  }

  const activeTraits: string[] = [];
  const inactiveTraits: SolverResult['inactiveTraits'] = [];
  for (let i = 0; i < data.generalTraits.length; i += 1) {
    const trait = data.generalTraits[i];
    if (trait.thresholds.length === 0) continue;
    const count = finalCounts[i];
    if (count >= trait.thresholds[0]) {
      activeTraits.push(trait.name);
    } else {
      inactiveTraits.push({
        name: trait.name,
        count,
        nextThreshold: trait.thresholds[0],
        diff: trait.thresholds[0] - count,
      });
    }
  }
  inactiveTraits.sort((a, b) => a.diff - b.diff || a.name.localeCompare(b.name));

  const result: SolverResult = {
    heroes: [...heroes],
    traitCounts,
    emblemAllocations,
    usedPopulation,
    activeTraits,
    inactiveTraits,
    luxDoubleTrait: luxSelected ? luxDoubleTrait : null,
    unusedEmblems: data.emblemCount - emblemUsed,
    timedOut,
    approximate,
  };

  if (mode === 'maxQuality') {
    const scores = computeQualityScores(
      heroes,
      data.generalTraits,
      traitCounts,
      activeTraits.length,
      usedPopulation,
      data.population,
    );
    result.qualityScore = scores.total;
    result.scoreBreakdown = {
      costScore: scores.costScore,
      traitScore: scores.traitScore,
      bonusScore: scores.bonusScore,
    };
  }

  return result;
}

/** 用于剪枝：计算剩余候选英雄中仍可能新增的 general 羁绊数量上界 */
export function remainingCoverageUpperBound(
  data: SolverData,
  startIndex: number,
  activeMask: bigint,
  remainingSlots: number,
): number {
  if (remainingSlots <= 0 || startIndex >= data.candidates.length) return 0;

  let unionMask = 0n;
  const newCounts: number[] = [];
  for (let i = startIndex; i < data.candidates.length; i += 1) {
    const newMask = data.heroMasks[i] & ~activeMask;
    if (newMask === 0n) continue;
    unionMask |= newMask;
    newCounts.push(popcount(newMask));
  }

  const distinct = popcount(unionMask);
  newCounts.sort((a, b) => b - a);
  let sumTopK = 0;
  for (let k = 0; k < Math.min(remainingSlots, newCounts.length); k += 1) {
    sumTopK += newCounts[k];
  }
  // 最大覆盖数不超过「不同元素总数」也不超过「前 K 个集合大小之和」
  return Math.min(distinct, sumTopK);
}

/** 计算固定纹章在当前基础上还能新增激活多少个 general 羁绊（用于剪枝上界） */
export function emblemActivationUpperBound(
  counts: Uint8Array,
  data: SolverData,
  activeMask: bigint,
): number {
  let reachable = 0;
  for (let i = 0; i < data.generalTraits.length; i += 1) {
    const trait = data.generalTraits[i];
    if (trait.thresholds.length === 0) continue;
    if ((activeMask & maskOf(i)) !== 0n) continue;
    if (data.emblemCounts[i] > 0 && counts[i] + data.emblemCounts[i] >= trait.thresholds[0]) {
      reachable += 1;
    }
  }
  return reachable;
}

export function totalCost(heroes: Champion[]): number {
  return heroes.reduce((s, h) => s + h.cost, 0);
}

/** 比较两个结果：a 比 b 更优时返回 true（模式 A 先比羁绊数再比费用，模式 B 比质量分） */
export function resultIsBetter(
  a: SolverResult | null,
  b: SolverResult,
  mode: SolverMode,
): boolean {
  if (a === null) return true;
  if (mode === 'maxTraits') {
    if (b.activeTraits.length !== a.activeTraits.length) {
      return b.activeTraits.length > a.activeTraits.length;
    }
    return totalCost(b.heroes) > totalCost(a.heroes);
  }
  return (b.qualityScore ?? -1) > (a.qualityScore ?? -1);
}

/** 给定拉克丝双倍选择，分配转职并组装结果 */
export function evaluateWithDouble(
  data: SolverData,
  heroes: Champion[],
  baseCounts: Uint8Array,
  luxDoubleTrait: string | null,
  mode: SolverMode,
  timedOut = false,
  approximate = false,
): SolverResult {
  const luxSelected = heroes.some((h) => isLux(h));
  return finalizeResult({
    data,
    heroes,
    baseCounts,
    luxDoubleTrait: luxSelected ? luxDoubleTrait : null,
    mode,
    timedOut,
    approximate,
  });
}

/**
 * 选择最优拉克丝双倍羁绊。
 *  - 未含拉克丝 -> null
 *  - 用户配置为 '' -> null（不触发）
 *  - 用户指定具体羁绊 -> 直接返回
 *  - 用户配置为 null（自动最优）-> 遍历 targetTraits 与「不触发」，选目标函数最大者
 */
/** 自动选择最优拉克丝双倍 + 分配转职，返回最终结果 */
export function evaluateBest(
  data: SolverData,
  heroes: Champion[],
  baseCounts: Uint8Array,
  mode: SolverMode,
  timedOut = false,
  approximate = false,
): SolverResult {
  const luxDouble = chooseBestLuxDouble(data, heroes, baseCounts, mode);
  return evaluateWithDouble(data, heroes, baseCounts, luxDouble, mode, timedOut, approximate);
}

export function chooseBestLuxDouble(
  data: SolverData,
  heroes: Champion[],
  baseCounts: Uint8Array,
  mode: SolverMode,
): string | null {
  if (!heroes.some((h) => isLux(h))) return null;

  const configured = data.config.luxDoubleTrait;
  if (configured === '') return null;
  if (configured) return configured;

  let bestChoice: string | null = null;
  let bestResult = evaluateWithDouble(data, heroes, baseCounts, null, mode);
  for (const target of data.luxDoubleTargets) {
    const candidate = evaluateWithDouble(data, heroes, baseCounts, target, mode);
    if (resultIsBetter(bestResult, candidate, mode)) {
      bestResult = candidate;
      bestChoice = target;
    }
  }
  return bestChoice;
}
