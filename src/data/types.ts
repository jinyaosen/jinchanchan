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

export interface GameConfig {
  population: number; // 1~15
  emblemCount: number; // 0~10，纹章总数上限
  /** 拉克丝双倍羁绊名：null=自动最优，''=不触发，其它=指定羁绊名 */
  luxDoubleTrait: string | null;
  /** 是否启用卡兹克（启用后强制上场，并应用进化获得的额外羁绊） */
  includeKhazix: boolean;
  /** 卡兹克击杀进化获得的额外羁绊列表（可多选，来自裁决使/迅捷射手/狂战士/法师） */
  khazixEvolvedTraits: string[];
  lockedHeroIds: string[];
  /** 用户实际拥有的各类型纹章数量，键为羁绊 name，值为数量（总和 ≤ emblemCount） */
  emblemChoices: Record<string, number>;
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
  unusedEmblems?: number;
  timedOut?: boolean;
  approximate?: boolean;
}

export interface HeroChange {
  /** 本档相对上一档新增的英雄 */
  added: Champion[];
  /** 本档相对上一档移除的英雄 */
  removed: Champion[];
  /** 替换提示（移除 -> 新增） */
  replacements: { out: Champion; in: Champion }[];
}

export interface KhazixEvolutionState {
  /** 已进化羁绊数量（0~4） */
  count: number;
  /** 已进化获得的羁绊名列表 */
  traits: string[];
  /** 当前达到的击杀阈值（8/30/60/100），未进化或已满时为 null */
  killsThreshold: number | null;
}

export interface PopulationStep {
  population: number;
  /** 用于查费用曲线的等级（人口自动映射，人口 >10 时按 10 处理） */
  level: number;
  /** 本档允许的最高英雄费用 */
  maxCost: number;
  result: SolverResult;
  changes: HeroChange;
  /** 卡兹克进化信息（仅启用卡兹克时存在） */
  khazixEvolutions?: KhazixEvolutionState;
}

export interface PopulationPlan {
  startPopulation: number;
  targetPopulation: number;
  steps: PopulationStep[];
}

export interface PlanProgress {
  step: number;
  totalSteps: number;
  /** 0~1 */
  progress: number;
  message?: string;
}

export interface SolverProgress {
  phase: 'greedy' | 'backtrack' | 'local';
  progress: number; // 0~1
  message?: string;
  result?: SolverResult;
}

export interface WorkerRequest {
  type: 'solve' | 'plan';
  requestId: string;
  champions: Champion[];
  traits: Trait[];
  config: GameConfig;
  timeLimitMs: number;
}

export interface WorkerResponse {
  type: 'progress' | 'result' | 'error';
  requestId: string;
  payload:
    | SolverProgress
    | SolverResult
    | PlanProgress
    | PopulationPlan
    | { message: string };
}
