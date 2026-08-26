import { useGameStore } from '../store/gameStore';
import { findLux, getLuxDoubleTargets } from '../utils/luxEffect';

const AUTO = 'auto';
const NONE = 'none';

export default function LuxConfig() {
  const champions = useGameStore((s) => s.champions);
  const traits = useGameStore((s) => s.traits);
  const config = useGameStore((s) => s.config);
  const updateConfig = useGameStore((s) => s.updateConfig);

  const lux = findLux(champions);
  if (!lux) return null;

  const targets = getLuxDoubleTargets(traits, champions);
  const traitByName = new Map(traits.map((t) => [t.name, t]));

  const selectValue = config.luxDoubleTrait === null ? AUTO : config.luxDoubleTrait === '' ? NONE : config.luxDoubleTrait;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="lux-text text-xs font-bold">大元素使 · 拉克丝</span>
        <span className="text-[10px] text-secondary">双倍计数羁绊</span>
      </div>
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          updateConfig({ luxDoubleTrait: v === AUTO ? null : v === NONE ? '' : v });
        }}
        className="w-full rounded-lg border border-line bg-ink px-3 py-2 text-sm text-primary outline-none focus:border-gold"
      >
        <option value={AUTO}>自动最优（推荐）</option>
        <option value={NONE}>不触发双倍</option>
        {targets.map((name) => {
          const trait = traitByName.get(name);
          const thresholds = trait ? trait.thresholds.join('/') : '';
          return (
            <option key={name} value={name}>
              {name}{thresholds ? `（${thresholds}）` : ''}
            </option>
          );
        })}
      </select>
      <p className="text-[10px] text-disabled">
        选择后，拉克丝对该羁绊的计数贡献为 2 点；自动模式由算法选择使目标函数最大的羁绊。
      </p>
    </div>
  );
}
