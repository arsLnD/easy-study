interface ProgressBarProps {
  percent: number;
  color?: string;
  trackClassName?: string;
  heightClassName?: string;
}

/**
 * Универсальный прогресс-бар (используется и для "план/факт" по категориям,
 * и для прогресса накопления по целям). Если percent > 100, цвет заливки
 * автоматически становится "expense" (красный) — визуальный сигнал
 * превышения бюджета без дополнительного текста.
 */
export function ProgressBar({ percent, color, trackClassName = "", heightClassName = "h-2.5" }: ProgressBarProps) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const isOver = percent > 100;
  const fillColor = isOver ? "#FF5470" : color ?? "#7C5CFF";

  return (
    <div className={`w-full overflow-hidden rounded-full bg-surfaceMuted ${heightClassName} ${trackClassName}`}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${clamped}%`, backgroundColor: fillColor }}
      />
    </div>
  );
}
