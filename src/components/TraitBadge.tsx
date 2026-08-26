import type { Trait } from '../data/types';
import ProgressBar from './ProgressBar';

interface TraitBadgeProps {
  trait: Trait;
  count: number;
  emblemCount?: number;
  luxAssisted?: boolean;
}

function nextThresholdInfo(trait: Trait, count: number): { next: number | null; progress: number } {
  if (trait.thresholds.length === 0) return { next: null, progress: 1 };
  const next = trait.thresholds.find((t) => t > count);
  if (next == null) return { next: null, progress: 1 };
  const prev = [...trait.thresholds].reverse().find((t) => t <= count) ?? 0;
  return { next, progress: (count - prev) / (next - prev) };
}

export default function TraitBadge({ trait, count, emblemCount = 0, luxAssisted = false }: TraitBadgeProps) {
  const active = trait.thresholds.length > 0 && count >= trait.thresholds[0];
  const info = nextThresholdInfo(trait, count);

  return (
    <div
      className={`rounded-xl border p-3 ${
        active ? 'border-gold/60 bg-gold/5' : 'border-line bg-panel'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold text-primary">{trait.name}</span>
        <span className="flex shrink-0 items-center gap-1">
          {luxAssisted && (
            <span className="lux-text rounded bg-panel px-1 text-[9px] font-bold">双</span>
          )}
          {emblemCount > 0 && (
            <span className="rounded bg-gold/20 px-1 text-[9px] font-bold text-gold">转×{emblemCount}</span>
          )}
        </span>
      </div>

      <div className="mb-2 flex items-baseline gap-1">
        <span className={`text-lg font-bold ${active ? 'text-gold' : 'text-secondary'}`}>{count}</span>
        {info.next != null ? (
          <span className="text-xs text-secondary">/ {info.next}</span>
        ) : active ? (
          <span className="text-xs text-secondary">已满级</span>
        ) : (
          <span className="text-xs text-secondary">/ {trait.thresholds[0]}</span>
        )}
      </div>

      <ProgressBar value={info.progress} color={active ? '#C9A96E' : '#4A5568'} />
    </div>
  );
}
