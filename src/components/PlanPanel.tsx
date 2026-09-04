import { Play, X } from 'lucide-react';
import type { Trait } from '../data/types';
import { useGameStore } from '../store/gameStore';
import { cancelPlan, startPlan } from '../solvers/workerClient';
import HeroCard from './HeroCard';
import TraitBadge from './TraitBadge';
import ProgressBar from './ProgressBar';

/** 运营规划：从低人口到高人口逐档展示阵容与新增/替换/移除变化。 */
export default function PlanPanel() {
  const plan = useGameStore((s) => s.plan);
  const isPlanning = useGameStore((s) => s.isPlanning);
  const isComputing = useGameStore((s) => s.isComputing);
  const planProgress = useGameStore((s) => s.planProgress);
  const planProgressMessage = useGameStore((s) => s.planProgressMessage);
  const traits = useGameStore((s) => s.traits);
  const config = useGameStore((s) => s.config);

  const traitByName = new Map(traits.map((t) => [t.name, t]));

  if (isPlanning) {
    return (
      <section className="panel space-y-3 p-4">
        <div className="text-sm font-bold text-primary">运营规划</div>
        <ProgressBar value={planProgress} color="#C9A96E" />
        <p className="text-center text-[11px] text-secondary">{planProgressMessage}</p>
        <button
          onClick={cancelPlan}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF6B6B] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
        >
          <X className="h-4 w-4" />
          取消生成
        </button>
      </section>
    );
  }

  if (!plan) {
    return (
      <section className="panel flex min-h-[320px] flex-col items-center justify-center gap-3 p-6">
        <p className="text-center text-sm text-disabled">
          生成从 4 人口到 {config.population} 人口的运营阵容规划，
          低人口用低费卡凑羁绊，随人口提升逐步替换为高费卡。
        </p>
        <button
          onClick={startPlan}
          disabled={isComputing}
          className="flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-ink hover:opacity-90 disabled:opacity-40"
        >
          <Play className="h-4 w-4" />
          生成运营规划
        </button>
      </section>
    );
  }

  if (plan.steps.length === 0) {
    return (
      <section className="panel flex min-h-[320px] items-center justify-center p-6">
        <p className="text-center text-sm text-disabled">
          人口上限低于起始人口（4 或锁定英雄占用），无法生成运营规划。
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-primary">
          运营规划 · {plan.startPopulation} → {plan.targetPopulation} 人口
        </h2>
        <button
          onClick={startPlan}
          className="rounded-lg border border-line px-3 py-1.5 text-xs text-secondary hover:border-gold hover:text-gold"
        >
          重新生成
        </button>
      </div>

      {plan.steps.map((step, index) => {
        const isFirst = index === 0;
        const sortedHeroes = [...step.result.heroes].sort(
          (a, b) => a.cost - b.cost || a.name.localeCompare(b.name),
        );

        return (
          <div key={step.population} className="panel space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-primary">人口 {step.population}</span>
              <span className="rounded bg-panel px-2 py-0.5 text-[11px] text-secondary">
                Lv {step.level}
              </span>
              <span className="rounded bg-panel px-2 py-0.5 text-[11px] text-secondary">
                最高 {step.maxCost} 费
              </span>
              {step.khazixEvolutions && (
                <span className="rounded bg-gold/10 px-2 py-0.5 text-[11px] text-gold">
                  卡兹克进化 {step.khazixEvolutions.count}/4
                  {step.khazixEvolutions.count > 0
                    ? `（击杀 ${step.khazixEvolutions.killsThreshold}：${step.khazixEvolutions.traits.join('、')}）`
                    : '（下一层 8 击杀）'}
                </span>
              )}
              <span className="ml-auto text-xs font-bold text-gold">
                {step.result.activeTraits.length} 个羁绊
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              {sortedHeroes.map((hero) => (
                <HeroCard key={hero.id} hero={hero} luxDoubleTrait={step.result.luxDoubleTrait} />
              ))}
            </div>

            {step.result.activeTraits.length > 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {step.result.activeTraits.map((name) => {
                  const trait = traitByName.get(name) as Trait | undefined;
                  if (!trait) return null;
                  const contributors = step.result.heroes
                    .filter((h) => h.traits.includes(name))
                    .map((h) => h.name);
                  return (
                    <TraitBadge
                      key={name}
                      trait={trait}
                      count={step.result.traitCounts[name] ?? 0}
                      emblemCount={step.result.emblemAllocations[name] ?? 0}
                      luxAssisted={step.result.luxDoubleTrait === name}
                      contributors={contributors}
                    />
                  );
                })}
              </div>
            )}

            {(step.changes.added.length > 0 ||
              step.changes.removed.length > 0 ||
              step.changes.replacements.length > 0) && (
              <div className="flex flex-wrap gap-1.5 border-t border-line pt-2">
                {isFirst && <span className="text-[10px] font-semibold text-secondary">初始阵容</span>}
                {step.changes.replacements.map((r) => (
                  <span
                    key={`${r.out.id}-${r.in.id}`}
                    className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] text-gold"
                  >
                    替换 {r.out.name} → {r.in.name}
                  </span>
                ))}
                {!isFirst &&
                  step.changes.added.map((h) => (
                    <span
                      key={h.id}
                      className="rounded-full border border-[#2ECC71]/40 bg-[#2ECC71]/10 px-2 py-0.5 text-[10px] text-[#2ECC71]"
                    >
                      新增 {h.name}
                    </span>
                  ))}
                {step.changes.removed.map((h) => (
                  <span
                    key={h.id}
                    className="rounded-full border border-[#FF6B6B]/40 bg-[#FF6B6B]/10 px-2 py-0.5 text-[10px] text-[#FF6B6B]"
                  >
                    移除 {h.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
