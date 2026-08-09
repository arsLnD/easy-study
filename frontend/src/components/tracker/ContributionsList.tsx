import type { GoalContributionWithGoal } from "@/types";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { formatDateLabel, formatMoney } from "@/utils/format";

/** История пополнений целей за месяц — часть раздела "Накопления" трекера. */
export function ContributionsList({
  contributions,
  currency,
}: {
  contributions: GoalContributionWithGoal[];
  currency: string;
}) {
  if (contributions.length === 0) {
    return <p className="py-4 text-center text-sm text-textSecondary">В этом месяце пополнений пока не было.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-border/60">
      {contributions.map((c) => (
        <div key={c.id} className="flex items-center gap-3 py-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${c.goal_color}22`, color: c.goal_color }}
          >
            <CategoryIcon name={c.goal_icon} size={16} />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium">{c.goal_name}</p>
            <p className="text-xs text-textSecondary">
              {formatDateLabel(c.contributed_on)}
              {c.note ? ` · ${c.note}` : ""}
            </p>
          </div>
          <span className="text-sm font-semibold text-income">+{formatMoney(c.amount, currency)}</span>
        </div>
      ))}
    </div>
  );
}
