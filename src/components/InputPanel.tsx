import { useState, type ReactNode } from 'react';
import { Lock, Minus, Play, Plus, Search, ShieldCheck, X } from 'lucide-react';
import type { Champion } from '../data/types';
import { EMBLEM_TRAIT_NAMES } from '../data/emblemTraits';
import { useGameStore } from '../store/gameStore';
import { cancelSolve, startSolve } from '../solvers/workerClient';
import LuxConfig from './LuxConfig';
import JsonUploader from './JsonUploader';
import ProgressBar from './ProgressBar';

function HeroSelect({
  label,
  icon,
  options,
  selectedIds,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  options: Champion[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = options.filter((c) => c.name.includes(query) || c.id.includes(query));

  const toggle = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-secondary">
        {icon}
        {label}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-disabled" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索英雄..."
          className="w-full rounded-lg border border-line bg-ink py-2 pl-7 pr-3 text-xs text-primary outline-none focus:border-gold"
        />
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedIds.map((id) => {
            const hero = options.find((c) => c.id === id);
            if (!hero) return null;
            return (
              <button
                key={id}
                onClick={() => toggle(id)}
                className="flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[10px] text-gold"
              >
                {hero.name}
                <X className="h-3 w-3" />
              </button>
            );
          })}
        </div>
      )}

      <div className="max-h-36 overflow-y-auto rounded-lg border border-line bg-ink p-2">
        {filtered.length === 0 && <p className="p-2 text-center text-[10px] text-disabled">无匹配英雄</p>}
        {filtered.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-panel">
            <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggle(c.id)} className="accent-[#C9A96E]" />
            <span className="flex-1 text-primary">{c.name}</span>
            <span className="text-disabled">{c.cost}费</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export default function InputPanel() {
  const config = useGameStore((s) => s.config);
  const updateConfig = useGameStore((s) => s.updateConfig);
  const champions = useGameStore((s) => s.champions);
  const isComputing = useGameStore((s) => s.isComputing);
  const progress = useGameStore((s) => s.progress);
  const progressMessage = useGameStore((s) => s.progressMessage);
  const error = useGameStore((s) => s.error);

  const totalEmblemSelected = EMBLEM_TRAIT_NAMES.reduce(
    (sum, name) => sum + (config.emblemChoices[name] ?? 0),
    0,
  );

  const updateEmblemCount = (value: number) => {
    const choices = { ...config.emblemChoices };
    const names = EMBLEM_TRAIT_NAMES.filter((n) => (choices[n] ?? 0) > 0);
    let total = names.reduce((sum, n) => sum + (choices[n] ?? 0), 0);

    while (total > value) {
      let target = names.find((n) => (choices[n] ?? 0) > 0);
      for (const n of names) {
        if ((choices[n] ?? 0) > (choices[target!] ?? 0)) target = n;
      }
      if (!target) break;
      choices[target] = (choices[target] ?? 0) - 1;
      if (choices[target] === 0) delete choices[target];
      total -= 1;
    }

    updateConfig({ emblemCount: value, emblemChoices: choices });
  };

  const changeEmblem = (name: string, delta: number) => {
    const current = config.emblemChoices[name] ?? 0;
    if (delta > 0 && totalEmblemSelected >= config.emblemCount) return;

    const next = current + delta;
    const choices = { ...config.emblemChoices };
    if (next <= 0) delete choices[name];
    else choices[name] = next;
    updateConfig({ emblemChoices: choices });
  };

  return (
    <aside className="panel space-y-5 p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-gold" />
        <h2 className="text-sm font-bold text-primary">输入配置</h2>
      </div>

      {/* 人口上限 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-secondary">人口上限</span>
          <span className="font-bold text-gold">{config.population}</span>
        </div>
        <input
          type="range"
          min={1}
          max={15}
          value={config.population}
          onChange={(e) => updateConfig({ population: Number(e.target.value) })}
          className="w-full"
        />
      </div>

      {/* 转职纹章数量 + 可用转职 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-secondary">转职纹章数量</span>
          <span className="font-bold text-gold">{config.emblemCount}</span>
        </div>
        <input
          type="range"
          min={0}
          max={10}
          value={config.emblemCount}
          onChange={(e) => updateEmblemCount(Number(e.target.value))}
          className="w-full"
        />

        <div className="flex items-center justify-between pt-1 text-xs">
          <span className="font-semibold text-secondary">选择可用转职（可多选）</span>
          <span className="font-bold text-gold">
            {totalEmblemSelected} / {config.emblemCount}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {EMBLEM_TRAIT_NAMES.map((name) => {
            const qty = config.emblemChoices[name] ?? 0;
            const active = qty > 0;
            const canAdd = totalEmblemSelected < config.emblemCount;
            return (
              <div
                key={name}
                className={`flex items-center justify-between gap-1 rounded-lg border px-2 py-1.5 text-[11px] transition ${
                  active
                    ? 'border-gold bg-gold/10 text-gold'
                    : 'border-line bg-ink text-secondary'
                }`}
              >
                <span className="truncate">{name}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => changeEmblem(name, -1)}
                    disabled={!active}
                    className="flex h-5 w-5 items-center justify-center rounded bg-ink text-primary disabled:opacity-30"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-4 text-center font-bold">{qty}</span>
                  <button
                    onClick={() => changeEmblem(name, 1)}
                    disabled={!canAdd}
                    className="flex h-5 w-5 items-center justify-center rounded bg-ink text-primary disabled:opacity-30"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 拉克丝配置 */}
      <LuxConfig />

      {/* 锁定英雄 */}
      <HeroSelect
        label="锁定英雄（必须上场）"
        icon={<Lock className="h-4 w-4 text-gold" />}
        options={champions}
        selectedIds={config.lockedHeroIds}
        onChange={(ids) => updateConfig({ lockedHeroIds: ids })}
      />

      {/* 计算/取消 */}
      {isComputing ? (
        <div className="space-y-2">
          <ProgressBar value={progress} color="#FF6B6B" />
          <p className="text-center text-[11px] text-secondary">{progressMessage}</p>
          <button
            onClick={cancelSolve}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#FF6B6B] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
          >
            <X className="h-4 w-4" />
            取消计算
          </button>
        </div>
      ) : (
        <button
          onClick={startSolve}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-sm font-bold text-ink hover:opacity-90"
        >
          <Play className="h-4 w-4" />
          计算最优组合
        </button>
      )}

      {error && (
        <p className="rounded-lg border border-[#FF6B6B]/40 bg-[#FF6B6B]/10 px-3 py-2 text-[11px] text-[#FF6B6B]">
          {error}
        </p>
      )}

      <div className="border-t border-line pt-3">
        <JsonUploader />
      </div>
    </aside>
  );
}
