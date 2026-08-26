import type { Champion, Trait } from '../data/types';

/**
 * 拉克丝「大元素使」特效处理。
 * 拉克丝登场时，可选择一个 targetTraits 中的 general 羁绊获得双倍计数（该羁绊贡献 2 点）。
 */

export const LUX_ELEMENTALIST_NAME = '大元素使';

/** 找到拉克丝（id === "lux" 或拥有大元素使羁绊） */
export function findLux(champions: Champion[]): Champion | undefined {
  return champions.find((c) => c.id === 'lux' || c.traits.includes(LUX_ELEMENTALIST_NAME));
}

export function isLux(hero: Champion): boolean {
  return hero.id === 'lux' || hero.traits.includes(LUX_ELEMENTALIST_NAME);
}

/** 获取大元素使羁绊定义 */
export function findElementalist(traits: Trait[]): Trait | undefined {
  return traits.find((t) => t.name === LUX_ELEMENTALIST_NAME || t.id === 'elementalist');
}

/**
 * 获取可被拉克丝双倍的 general 羁绊名列表。
 * 优先读 effect.targetTraits，缺失时用拉克丝自身除大元素使外的羁绊。
 */
export function getLuxDoubleTargets(traits: Trait[], champions: Champion[]): string[] {
  const elementalist = findElementalist(traits);
  const targets = elementalist?.effect?.targetTraits ?? [];
  if (targets.length > 0) return targets;

  const lux = findLux(champions);
  if (!lux) return [];
  return lux.traits.filter((t) => t !== LUX_ELEMENTALIST_NAME && t !== elementalist?.name);
}
