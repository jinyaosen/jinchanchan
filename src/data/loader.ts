import type { Champion, Trait, TraitEffect } from './types';
import { EMBLEM_TRAIT_NAMES } from './emblemTraits';

/**
 * 数据加载与归一化。
 *
 * 说明：提示词给出的 traits.json 示例包含 `type` 与 `effect` 字段，但实际提供的
 * S18 数据可能省略这两个字段。这里做「宽松解析 + 智能归一化」：
 *  - 若存在 `type`，直接使用；
 *  - 若缺失，则根据 S18 的专属羁绊 ID 推断 exclusive，其余视为 general；
 *  - 若「大元素使」缺少 `effect`，则从拉克丝自身的其它羁绊推导 targetTraits。
 */

interface RawChampion {
  id?: unknown;
  name?: unknown;
  cost?: unknown;
  traits?: unknown;
  slots?: unknown;
  isChosen?: unknown;
}

interface RawTrait {
  id?: unknown;
  name?: unknown;
  thresholds?: unknown;
  hasEmblem?: unknown;
  emblemName?: unknown;
  type?: unknown;
  effect?: unknown;
}

/** S18 中属于「专属」的羁绊 ID（不计入羁绊数量目标函数） */
const EXCLUSIVE_TRAIT_IDS = new Set<string>([
  'elementalist', // 大元素使
  'nemesis', // 宿敌
  'apexpredator', // 顶级掠食者
  'monarch', // 帝王斑蝶
  'monolith', // 魔岩巨兽
  'huntress', // 狂野女猎手
  'gemknight', // 宝石骑士
  'ancientspirit', // 远古树精
  'greenfather', // 翠神
  'moonpriestess', // 月华神女
  'bountyhunter', // 赏金猎人
  'eclipse', // 日月双蚀
]);

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`字段 ${field} 必须是有效字符串`);
  }
  return value;
}

function asNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`字段 ${field} 必须是有效数字`);
  }
  return value;
}

function asStringArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new Error(`字段 ${field} 必须是字符串数组`);
  }
  return value as string[];
}

function parseEffect(value: unknown): TraitEffect | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'object') {
    throw new Error('effect 必须是对象');
  }
  const obj = value as Record<string, unknown>;
  return {
    description: asString(obj.description, 'effect.description'),
    targetTraits: asStringArray(obj.targetTraits, 'effect.targetTraits'),
  };
}

export function parseChampions(input: unknown): Champion[] {
  if (!Array.isArray(input)) {
    throw new Error('champions.json 顶层必须是数组');
  }
  return input.map((raw, idx) => {
    const r = raw as RawChampion;
    return {
      id: asString(r.id, `champions[${idx}].id`),
      name: asString(r.name, `champions[${idx}].name`),
      cost: asNumber(r.cost, `champions[${idx}].cost`),
      traits: asStringArray(r.traits, `champions[${idx}].traits`),
      slots: r.slots == null ? 1 : asNumber(r.slots, `champions[${idx}].slots`),
    } satisfies Champion;
  });
}

export function parseTraits(input: unknown, champions: Champion[]): Trait[] {
  if (!Array.isArray(input)) {
    throw new Error('traits.json 顶层必须是数组');
  }
  const traits = input.map((raw, idx) => {
    const r = raw as RawTrait;
    const id = asString(r.id, `traits[${idx}].id`);
    const name = asString(r.name, `traits[${idx}].name`);
    const thresholds =
      r.thresholds == null
        ? []
        : (() => {
            if (!Array.isArray(r.thresholds) || r.thresholds.some((v) => typeof v !== 'number')) {
              throw new Error(`traits[${idx}].thresholds 必须是数字数组`);
            }
            return r.thresholds as number[];
          })();
    const hasEmblem =
      typeof r.hasEmblem === 'boolean'
        ? r.hasEmblem
        : (() => {
            throw new Error(`traits[${idx}].hasEmblem 必须是布尔值`);
          })();

    let type: 'general' | 'exclusive';
    if (r.type === 'general' || r.type === 'exclusive') {
      type = r.type;
    } else if (r.type != null) {
      throw new Error(`traits[${idx}].type 只能是 general 或 exclusive`);
    } else {
      // 数据缺失 type 时，使用 S18 专属羁绊名单 + 空阈值启发式推断。
      type = EXCLUSIVE_TRAIT_IDS.has(id) || thresholds.length === 0 ? 'exclusive' : 'general';
    }

    // 用户可选择的纹章羁绊必须是 general，即便原始数据误标为 exclusive 也强制纠正。
    if (EMBLEM_TRAIT_NAMES.includes(name)) {
      type = 'general';
    }

    const trait: Trait = {
      id,
      name,
      thresholds,
      hasEmblem,
      emblemName: typeof r.emblemName === 'string' ? r.emblemName : hasEmblem ? `${name}纹章` : '',
      type,
      effect: parseEffect(r.effect),
    };
    return trait;
  });

  deriveLuxEffect(traits, champions);
  return traits;
}

/**
 * 若「大元素使」缺少 effect，则用拉克丝的其它羁绊作为双倍候选。
 * 拉克丝识别：id === "lux" 或 traits 中包含「大元素使」。
 */
function deriveLuxEffect(traits: Trait[], champions: Champion[]): void {
  const elementalist = traits.find((t) => t.name === '大元素使' || t.id === 'elementalist');
  if (!elementalist || elementalist.effect) return;

  const lux = champions.find((c) => c.id === 'lux' || c.traits.includes('大元素使'));
  if (!lux) return;

  const targets = lux.traits.filter((name) => name !== '大元素使' && name !== elementalist.name);
  elementalist.effect = {
    description: '拉克丝登场时，从以下羁绊中随机选择一个获得双倍计数',
    targetTraits: targets,
  };
}

/**
 * 校验 champions 的羁绊名是否都能在 traits 中找到，并返回名称 -> Trait 索引表。
 * 同时修复 traits 中可能缺失的 type 后统一返回。
 */
export function normalizeDataset(
  champions: Champion[],
  traits: Trait[],
): { champions: Champion[]; traits: Trait[]; traitByName: Map<string, Trait> } {
  const traitByName = new Map<string, Trait>();
  for (const t of traits) traitByName.set(t.name, t);

  const missing = new Set<string>();
  for (const c of champions) {
    for (const name of c.traits) {
      if (!traitByName.has(name)) missing.add(name);
    }
  }
  if (missing.size > 0) {
    throw new Error(`以下英雄羁绊在 traits.json 中不存在：${[...missing].join('、')}`);
  }

  return { champions, traits, traitByName };
}
