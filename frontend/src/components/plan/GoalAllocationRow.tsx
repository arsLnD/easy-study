import type { Goal } from "@/types";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { ProgressBar } from "@/components/common/ProgressBar";
import { currencySymbol, formatMoney } from "@/utils/format";

interface Props {
  goal: Goal;
  value: string;
  onChange: (value: string) => void;
}

export function GoalAllocationRow({ goal, value, onChange }: Props) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${goal.color}22`, color: goal.color }}
      >
        <CategoryIcon name={goal.icon} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{goal.name}</p>
        <div className="mt-1 flex items-center gap-2">
          <ProgressBar percent={goal.progress_percent} color={goal.color} heightClassName="h-1.5" />
          <span className="whitespace-nowrap text-xs text-textSecondary">
            {formatMoney(goal.current_amount, goal.currency)} / {formatMoney(goal.target_amount, goal.currency)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-24 rounded-lg border border-border bg-surfaceMuted px-2.5 py-2 text-right text-sm
            outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <span className="text-xs text-textSecondary">{currencySymbol(goal.currency)}</span>
      </div>
    </div>
  );
}
