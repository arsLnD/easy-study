import type { Category, Goal } from "@/types";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { ProgressBar } from "@/components/common/ProgressBar";
import { currencySymbol, formatMoney } from "@/utils/format";

interface Props {
  category: Category;
  value: string;
  currency: string;
  onChange: (value: string) => void;
  /** Если категория — служебная категория цели, передаём саму цель для прогресс-бара. */
  goal?: Goal;
}

export function CategoryAllocationRow({ category, value, currency, onChange, goal }: Props) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${category.color}22`, color: category.color }}
      >
        <CategoryIcon name={category.icon} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium">{category.name}</p>
          {goal && (
            <span className="rounded-full bg-income/15 px-1.5 py-0.5 text-[10px] font-semibold text-income">
              Цель
            </span>
          )}
          {category.is_essential && !goal && (
            <span className="text-xs text-textSecondary">· Обязательная</span>
          )}
        </div>
        {goal && (
          <div className="mt-1 flex items-center gap-2">
            <ProgressBar percent={goal.progress_percent} color={goal.color} heightClassName="h-1.5" />
            <span className="whitespace-nowrap text-xs text-textSecondary">
              {formatMoney(goal.current_amount, goal.currency)} / {formatMoney(goal.target_amount, goal.currency)}
            </span>
          </div>
        )}
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
        <span className="text-xs text-textSecondary">{currencySymbol(currency)}</span>
      </div>
    </div>
  );
}
