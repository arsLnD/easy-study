import type { Goal } from "@/types";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { ProgressBar } from "@/components/common/ProgressBar";
import { formatMoney } from "@/utils/format";

export function GoalsProgressTable({ goals }: { goals: Goal[] }) {
  const active = goals.filter((g) => g.status !== "archived");

  if (active.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-textSecondary">
        Добавьте свои цели в разделе «Настройки → Цели», чтобы следить за прогрессом.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {active.map((goal) => (
        <div key={goal.id}>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${goal.color}22`, color: goal.color }}
            >
              <CategoryIcon name={goal.icon} size={16} />
            </div>
            <div className="flex-1">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">
                  {goal.name}
                  {goal.status === "completed" && <span className="ml-1.5 text-xs text-income">достигнута!</span>}
                </span>
                <span className="text-sm font-semibold">
                  {formatMoney(goal.current_amount, goal.currency)}
                  <span className="text-textSecondary"> / {formatMoney(goal.target_amount, goal.currency)}</span>
                </span>
              </div>
            </div>
          </div>
          <div className="ml-12 mt-1.5">
            <ProgressBar percent={goal.progress_percent} color={goal.color} />
          </div>
        </div>
      ))}
    </div>
  );
}
