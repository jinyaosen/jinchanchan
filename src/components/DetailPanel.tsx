import { useMemo } from 'react';
import { Sparkles, Wand2 } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import {
  buildCountsFromHeroes,
  evaluateBest,
  prepareSolverData,
  resultIsBetter,
} from '../solvers/common';

interface Suggestion {
  inHeroName: string;
  outHeroName: string;
  before: number;
  after: number;
}

export default function DetailPanel() {
  const result = useGameStore((s) => s.result);
  const champions = useGameStore((s) => s.champions);
  const traits = useGameStore((s) => s.traits);
  const config = useGameStore((s) => s.config);

  const suggestion = useMemo<Suggestion | null>(() => {
    if (!result || champions.length === 0 || traits.length === 0) return null;
    try {
      const data = prepareSolverData(champions, traits, config);
      const lockedIds = new Set(data.lockedHeroes.map((h) => h.id));
      const freeSelected = result.heroes.filter((h) => !lockedIds.has(h.id));
      const selectedIds = new Set(result.heroes.map((h) => h.id));
      const outside = data.candidates.filter((c) => !selectedIds.has(c.id));

      for (const inHero of freeSelected) {
        for (const outHero of outside) {
          const newHeroes = result.heroes.filter((h) => h.id !== inHero.id).concat(outHero);
          if (newHeroes.reduce((s, h) => s + h.slots, 0) > config.population) continue;
          const counts = buildCountsFromHeroes(newHeroes, data);
          const candidate = evaluateBest(data, newHeroes, counts);
          if (resultIsBetter(result, candidate)) {
            return {
              inHeroName: inHero.name,
              outHeroName: outHero.name,
              before: result.activeTraits.length,
              after: candidate.activeTraits.length,
            };
          }
        }
      }
    } catch {
      return null;
    }
    return null;
  }, [result, champions, traits, config]);

  const emblems = Object.entries(result?.emblemAllocations ?? {});
  const unusedEmblems = result?.unusedEmblems ?? 0;

  return (
    <aside className="space-y-4">
      {result && (
        <div className="panel space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-primary">
            <Wand2 className="h-4 w-4 text-gold" />
            拉克丝贡献
          </div>
          {result.luxDoubleTrait ? (
            <div className="rounded-xl border border-gold/40 bg-gold/5 p-3">
              <p className="text-xs text-primary">
                双倍羁绊：<span className="lux-text font-bold">{result.luxDoubleTrait}</span>
              </p>
              <p className="mt-1 text-[11px] text-secondary">
                拉克丝对该羁绊提供 2 点计数，帮助冲更高阈值层级。
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-disabled">
              {result.heroes.some((h) => h.traits.includes('大元素使'))
                ? '当前阵容含拉克丝，但未触发双倍或无需双倍即可最优。'
                : '当前阵容不含拉克丝，大元素使未生效。'}
            </p>
          )}
        </div>
      )}

      {result && (
        <div className="panel space-y-3 p-4">
          <div className="text-sm font-bold text-primary">转职分配</div>
          {emblems.length === 0 ? (
            <p className="text-[11px] text-disabled">未使用转职纹章</p>
          ) : (
            <div className="space-y-1">
              {emblems.map(([name, count]) => (
                <div key={name} className="flex justify-between text-xs">
                  <span className="text-secondary">{name}</span>
                  <span className="font-bold text-gold">×{count}</span>
                </div>
              ))}
            </div>
          )}
          {unusedEmblems > 0 && (
            <p className="text-[11px] text-[#FF6B6B]">{unusedEmblems} 个转职未使用</p>
          )}
        </div>
      )}

      {suggestion && (
        <div className="panel border-gold/40 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gold">
            <Sparkles className="h-4 w-4" />
            优化建议
          </div>
          <p className="text-xs leading-relaxed text-primary">
            将 <span className="font-bold text-[#FF6B6B]">{suggestion.inHeroName}</span> 替换为{' '}
            <span className="font-bold text-[#2ECC71]">{suggestion.outHeroName}</span>，
            羁绊数可从 {suggestion.before} 提升到 {suggestion.after}。
          </p>
        </div>
      )}
    </aside>
  );
}
