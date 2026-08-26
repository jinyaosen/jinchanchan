import type { Champion } from '../data/types';
import { isLux } from '../utils/luxEffect';
import { costColor } from '../utils/theme';

interface HeroCardProps {
  hero: Champion;
  luxDoubleTrait?: string | null;
  onLock?: () => void;
}

export default function HeroCard({ hero, luxDoubleTrait, onLock }: HeroCardProps) {
  const luxHero = isLux(hero);
  const hasDouble = luxHero && Boolean(luxDoubleTrait);

  return (
    <div className="flex w-16 flex-col items-center gap-1">
      <button
        type="button"
        onClick={onLock}
        title={onLock ? '点击固定该英雄并重新计算' : hero.name}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 bg-panel text-xs font-semibold text-primary transition hover:scale-105 ${
          hasDouble ? 'lux-rainbow' : ''
        }`}
        style={hasDouble ? undefined : { borderColor: costColor(hero.cost) }}
      >
        <span className="line-clamp-2 px-1 text-center leading-tight">{hero.name}</span>
        {hasDouble && (
          <span className="lux-text absolute -right-1 -top-1 rounded-full bg-panel px-1 text-[9px] font-bold shadow">
            双
          </span>
        )}
      </button>
      <span className="text-[11px]" style={{ color: costColor(hero.cost) }}>
        {hero.cost}费
      </span>
      {hasDouble && luxDoubleTrait && (
        <span className="lux-text max-w-full truncate text-[9px]" title={luxDoubleTrait}>
          {luxDoubleTrait}
        </span>
      )}
    </div>
  );
}
