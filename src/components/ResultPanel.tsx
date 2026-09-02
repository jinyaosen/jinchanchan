import { Lock } from 'lucide-react';
import type { Champion, Trait } from '../data/types';
import { useGameStore } from '../store/gameStore';
import { startSolve } from '../solvers/workerClient';
import { findLux, isLux } from '../utils/luxEffect';
import { costColor } from '../utils/theme';
import HeroCard from './HeroCard';
import TraitBadge from './TraitBadge';
import ProgressBar from './ProgressBar';

export default function ResultPanel() {
  const result = useGameStore((s) => s.result);
  const traits = useGameStore((s) => s.traits);
  const champions = useGameStore((s) => s.champions);
  const config = useGameStore((s) => s.config);
  const updateConfig = useGameStore((s) => s.updateConfig);
  const isComputing = useGameStore((s) => s.isComputing);

  const traitByName = new Map(traits.map((t) => [t.name, t]));
  const lux = findLux(champions);

  if (!result) {
    return (
      <section className="panel flex min-h-[320px] items-center justify-center p-6">
        <div className="text-center text-sm text-disabled">
          {isComputing ? '正在计算中...' : '调整左侧配置后点击「计算最优组合」'}
        </div>
      </section>
    );
  }

  const lockAndRecompute = (heroId: string) => {
    if (!config.lockedHeroIds.includes(heroId)) {
      updateConfig({ lockedHeroIds: [...config.lockedHeroIds, heroId] });
    }
    startSolve();
  };

  const luxInResult = result.heroes.some((h) => h.id === lux?.id || h.traits.includes('大元素使'));
  const luxConfigured = config.luxDoubleTrait && config.luxDoubleTrait !== '';

  const heroesByCost = new Map<number, Champion[]>();
  for (const hero of result.heroes) {
    const list = heroesByCost.get(hero.cost) ?? [];
    list.push(hero);
    heroesByCost.set(hero.cost, list);
  }
  const sortedHeroes = [...result.heroes].sort(
    (a, b) => a.cost - b.cost || a.name.localeCompare(b.name),
  );
  const sortedCosts = [...heroesByCost.keys()].sort((a, b) => a - b);
  const totalCost = result.heroes.reduce((sum, hero) => sum + hero.cost, 0);

  return (
    <section className="space-y-4">
      {/* 阵容卡片 */}
      <div className="panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-primary">推荐阵容</h2>
          <span className="text-xs text-secondary">点击英雄可固定并重算</span>
        </div>
        <div className="flex flex-wrap gap-3">
          {sortedHeroes.map((hero) => (
            <HeroCard
              key={hero.id}
              hero={hero}
              luxDoubleTrait={result.luxDoubleTrait}
              onLock={() => lockAndRecompute(hero.id)}
            />
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-secondary">
            人口 <span className="font-bold text-primary">{result.usedPopulation}</span> / {config.population}
          </span>
          <div className="flex-1">
            <ProgressBar
              value={result.usedPopulation / Math.max(1, config.population)}
              color={result.usedPopulation > config.population ? '#FF6B6B' : '#C9A96E'}
            />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-line bg-ink/50 p-3">
          <div className="mb-2 text-xs font-semibold text-secondary">英雄构成（含羁绊）</div>
          <div className="flex flex-wrap gap-2">
            {sortedHeroes.map((hero) => {
              const doubleTrait = isLux(hero) ? result.luxDoubleTrait : null;
              const generalTraits = hero.traits.filter(
                (name) => traitByName.get(name)?.type === 'general',
              );
              const displayTraits =
                doubleTrait && !generalTraits.includes(doubleTrait)
                  ? [...generalTraits, doubleTrait]
                  : generalTraits;
              return (
                <div key={hero.id} className="rounded-lg border border-line bg-panel px-2 py-2">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-semibold text-primary">{hero.name}</span>
                    <span className="text-[10px]" style={{ color: costColor(hero.cost) }}>
                      {hero.cost}费
                    </span>
                    {doubleTrait && (
                      <span className="lux-text text-[9px] font-bold">双·{doubleTrait}</span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {displayTraits.map((name) => (
                      <span key={name} className="rounded bg-ink px-1 py-0.5 text-[9px] text-secondary">
                        {name}
                        {name === doubleTrait && <span className="lux-text font-bold"> ×2</span>}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 text-[11px] text-secondary">
            费用构成：
            {sortedCosts.map((cost) => {
              const heroes = heroesByCost.get(cost) ?? [];
              return (
                <span key={cost} className="mr-1">
                  <span className="font-bold" style={{ color: costColor(cost) }}>
                    {cost}费 ×{heroes.length}
                  </span>
                  {heroes.length > 0 && <span className="text-disabled">（{heroes.map((hero) => hero.name).join('、')}）</span>}
                </span>
              );
            })}
          </div>
          <div className="mt-1 text-xs text-secondary">
            阵容总费用 <span className="font-bold text-primary">{totalCost}</span>
          </div>
        </div>

        {result.usedPopulation > config.population && (
          <p className="mt-1 text-[11px] text-[#FF6B6B]">人口超出上限</p>
        )}
        {luxConfigured && !luxInResult && (
          <p className="mt-2 text-[11px] text-disabled">
            当前阵容不含拉克丝，双倍配置未生效
          </p>
        )}
      </div>

      {/* 激活羁绊 */}
      <div className="panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold text-primary">激活羁绊</h2>
          <span className="text-xs font-bold text-gold">{result.activeTraits.length} 个</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {result.activeTraits.map((name) => {
            const trait = traitByName.get(name) as Trait | undefined;
            if (!trait) return null;

            const contributors = result.heroes
              .filter((hero) => hero.traits.includes(name))
              .map((hero) => hero.name);
            if (result.luxDoubleTrait === name) {
              const luxName = lux?.name ?? '拉克丝';
              if (contributors.includes(luxName)) {
                contributors[contributors.indexOf(luxName)] = `${luxName}×2`;
              } else {
                contributors.push(`${luxName}·双倍`);
              }
            }
            const emblemCount = result.emblemAllocations[name] ?? 0;
            if (emblemCount > 0) contributors.push(`转职×${emblemCount}`);

            return (
              <TraitBadge
                key={name}
                trait={trait}
                count={result.traitCounts[name] ?? 0}
                emblemCount={emblemCount}
                luxAssisted={result.luxDoubleTrait === name}
                contributors={contributors}
              />
            );
          })}
        </div>
      </div>

      {/* 差一点激活 */}
      {result.inactiveTraits.length > 0 && (
        <div className="panel p-4">
          <h2 className="mb-3 text-sm font-bold text-secondary">差一点激活</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {result.inactiveTraits.map((item) => (
              <div key={item.name} className="rounded-xl border border-line bg-panel p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs text-secondary">{item.name}</span>
                  <span className="text-[10px] text-disabled">差 {item.diff}</span>
                </div>
                <div className="text-lg font-bold text-secondary">{item.count}</div>
                <ProgressBar value={item.count / Math.max(1, item.nextThreshold)} color="#4A5568" />
              </div>
            ))}
          </div>
        </div>
      )}

      {result.approximate && (
        <p className="flex items-center gap-1 text-[11px] text-gold">
          <Lock className="h-3 w-3" />
          已超时，当前为近似最优解
        </p>
      )}
    </section>
  );
}
