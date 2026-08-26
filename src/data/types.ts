/**
 * 全局数据类型定义。
 * 字段名严格遵循项目提示词，避免与 champions.json / traits.json 产生映射歧义。
 */

export interface Champion {
  id: string;
  name: string;
  cost: number;
  traits: string[];
  slots: number;
}

export interface TraitEffect {
  description: string;
  /** 大元素使可触发的双倍羁绊名列表 */
  targetTraits: string[];
}

export interface Trait {
  id: string;
  name: string;
  thresholds: number[];
  hasEmblem: boolean;
  emblemName?: string;
  /** 通用羁绊（计入目标函数）或专属羁绊（不计入目标函数） */
  type: 'general' | 'exclusive';
  effect?: TraitEffect;
}

export type SolverMode = 'maxTraits' | 'maxQuality';

export interface GameConfig {
  population: number; // 1~15
  emblemCount: number; // 0~10，纹章总数上限
  /** 拉克丝双倍羁绊名：null=自动最优，''=不触发，其它=指定羁绊名 */
  luxDoubleTrait: string | null;
  lockedHeroIds: string[];
  /** 用户实际拥有的各类型纹章数量，键为羁绊 name，值为数量（总和 ≤ emblemCount） */
  emblemChoices: Record<string, number>;
}

export interface ScoreBreakdown {
  costScore: number;
  traitScore: number;
  bonusScore: number;
}

export interface InactiveTrait {
  name: string;
  count: number;
  nextThreshold: number;
  diff: number;
}

export interface SolverResult {
  heroes: Champion[];
  /** 每个羁绊的最终计数（含拉克丝双倍与转职加成），键为羁绊 name */
  traitCounts: Record<string, number>;
  /** 转职分配，键为羁绊 name，值为分配数量 */
  emblemAllocations: Record<string, number>;
  usedPopulation: number;
  /** 激活的 general 羁绊名列表 */
  activeTraits: string[];
  inactiveTraits: InactiveTrait[];
  /** 实际使用的拉克丝双倍羁绊名（自动选择时返回选中的那个） */
  luxDoubleTrait: string | null;
  qualityScore?: number;
  scoreBreakdown?: ScoreBreakdown;
  unusedEmblems?: number;
  timedOut?: boolean;
  approximate?: boolean;
}

export interface SolverProgress {
  phase: 'greedy' | 'backtrack' | 'local';
  progress: number; // 0~1
  message?: string;
  result?: SolverResult;
}

export interface WorkerRequest {
  type: 'solve';
  requestId: string;
  mode: SolverMode;
  champions: Champion[];
  traits: Trait[];
  config: GameConfig;
  timeLimitMs: number;
}

export interface WorkerResponse {
  type: 'progress' | 'result' | 'error';
  requestId: string;
  payload: SolverProgress | SolverResult | { message: string };
}
