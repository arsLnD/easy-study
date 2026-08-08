import type { CategorySummaryItem } from "@/types";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { ProgressBar } from "@/components/common/ProgressBar";
import { formatMoney } from "@/utils/format";

/**
 * Таблица "план / факт" по категориям за выбранный период — центральный
 * элемент экрана трекера (п.3 требований: "видит табличку своих целей/планов").
 */
export function CategorySummaryTable({ items, currency }: { items: CategorySummaryItem[]; currency: string }) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-textSecondary">Пока нет данных за этот период.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => {
        const isOver = item.percent_used > 100;
        return (
          <div key={item.category_id}>
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${item.category_color}22`, color: item.category_color }}
              >
                <CategoryIcon name={item.category_icon} size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium">{item.category_name}</span>
                  <span className={`text-sm font-semibold ${isOver ? "text-expense" : "text-textPrimary"}`}>
                    {formatMoney(item.actual_amount, currency)}
                    {parseFloat(item.planned_amount) > 0 && (
                      <span className="text-textSecondary"> / {formatMoney(item.planned_amount, currency)}</span>
                    )}
                  </span>
                </div>
              </div>
            </div>
            {parseFloat(item.planned_amount) > 0 && (
              <div className="ml-12 mt-1.5">
                <ProgressBar percent={item.percent_used} color={item.category_color} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
