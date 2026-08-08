type PeriodOption = "day" | "week" | "month";

interface Props {
  value: PeriodOption;
  onChange: (value: PeriodOption) => void;
}

const LABELS: Record<PeriodOption, string> = {
  day: "День",
  week: "Неделя",
  month: "Месяц",
};

export function PeriodSelector({ value, onChange }: Props) {
  return (
    <div className="flex gap-1.5 rounded-xl border border-border bg-surface p-1">
      {(Object.keys(LABELS) as PeriodOption[]).map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
            value === option ? "bg-primary text-white" : "text-textSecondary hover:text-textPrimary"
          }`}
        >
          {LABELS[option]}
        </button>
      ))}
    </div>
  );
}

export type { PeriodOption };
