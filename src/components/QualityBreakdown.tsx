import type { SolverResult } from '../data/types';
import ProgressBar from './ProgressBar';

interface QualityBreakdownProps {
  result: SolverResult;
}

const BREAKDOWN_COLORS = {
  cost: '#3498DB',
  trait: '#C9A96E',
  bonus: '#2ECC71',
};

export default function QualityBreakdown({ result }: QualityBreakdownProps) {
  const total = result.qualityScore ?? 0;
  const breakdown = result.scoreBreakdown ?? { costScore: 0, traitScore: 0, bonusScore: 0 };
  const maxPart = Math.max(breakdown.costScore, breakdown.traitScore, breakdown.bonusScore, 1);

  // 环形仪表盘（总分）
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const ringPct = Math.min(1, total / 500);
  const dashOffset = circumference * (1 - ringPct);

  return (
    <div className="panel space-y-4 p-4">
      <div className="flex items-center gap-5">
        <div className="relative h-32 w-32 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="#2A3142" strokeWidth="10" />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#C9A96E"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gold">{total}</span>
            <span className="text-[10px] text-secondary">质量总分</span>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          {[
            { label: '费用分', value: breakdown.costScore, color: BREAKDOWN_COLORS.cost },
            { label: '羁绊分', value: breakdown.traitScore, color: BREAKDOWN_COLORS.trait },
            { label: '功能分', value: breakdown.bonusScore, color: BREAKDOWN_COLORS.bonus },
          ].map((item) => (
            <div key={item.label}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-secondary">{item.label}</span>
                <span className="font-semibold text-primary">{item.value}</span>
              </div>
              <ProgressBar value={item.value / maxPart} color={item.color} />
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-semibold text-secondary">费用分布</div>
        <div className="flex items-end gap-2">
          {[1, 2, 3, 4, 5].map((cost) => {
            const count = result.heroes.filter((h) => h.cost === cost).length;
            const maxCount = Math.max(
              1,
              ...[1, 2, 3, 4, 5].map((c) => result.heroes.filter((h) => h.cost === c).length),
            );
            return (
              <div key={cost} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-xs text-secondary">{count}</span>
                <div
                  className="w-full rounded-t"
                  style={{
                    height: `${Math.max(4, (count / maxCount) * 48)}px`,
                    backgroundColor: ['#7A7A7A', '#2ECC71', '#3498DB', '#9B59B6', '#F1C40F'][cost - 1],
                  }}
                />
                <span className="text-[10px] text-secondary">{cost}费</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
