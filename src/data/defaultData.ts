import championsRaw from '../../champions.json';
import traitsRaw from '../../traits.json';
import { normalizeDataset, parseChampions, parseTraits } from './loader';
import type { Champion, Trait } from './types';

/**
 * 默认示例数据。直接打包项目根目录下的 champions.json 与 traits.json，
 * 保证 `npm run dev` 后即可看到完整界面与结果。
 */
const champions = parseChampions(championsRaw);
const traits = parseTraits(traitsRaw, champions);
const dataset = normalizeDataset(champions, traits);

export const DEFAULT_CHAMPIONS: Champion[] = dataset.champions;
export const DEFAULT_TRAITS: Trait[] = dataset.traits;
export const DEFAULT_TRAIT_BY_NAME: Map<string, Trait> = dataset.traitByName;
