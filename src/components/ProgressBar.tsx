interface ProgressBarProps {
  value: number; // 0~1
  color?: string;
  className?: string;
  showLabel?: boolean;
}

export default function ProgressBar({
  value,
  color = '#C9A96E',
  className = '',
  showLabel = false,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={`relative h-2 w-full overflow-hidden rounded-full bg-line ${className}`}>
      <div
        className="h-full rounded-full transition-all duration-300"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center text-[10px] text-primary">
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}
