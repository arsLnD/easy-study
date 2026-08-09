import { Pencil, Trash2 } from "lucide-react";
import type { Transaction } from "@/types";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { formatDateLabel, formatMoney } from "@/utils/format";

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => void;
  onEdit?: (transaction: Transaction) => void;
}

export function TransactionList({ transactions, onDelete, onEdit }: Props) {
  if (transactions.length === 0) {
    return <p className="py-6 text-center text-sm text-textSecondary">Записей за этот период пока нет.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-border/60">
      {transactions.map((tx) => {
        const isGoalContribution = !!tx.category?.linked_goal_id;
        return (
          <div key={tx.id} className="flex items-center gap-3 py-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                backgroundColor: `${tx.category?.color ?? "#7C5CFF"}22`,
                color: tx.category?.color ?? "#7C5CFF",
              }}
            >
              <CategoryIcon name={tx.category?.icon ?? "tag"} size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">
                {tx.category?.name ?? "Без категории"}
                {isGoalContribution && (
                  <span className="ml-1.5 rounded-full bg-income/15 px-1.5 py-0.5 text-[10px] font-semibold text-income">
                    Цель
                  </span>
                )}
              </p>
              <p className="text-xs text-textSecondary">
                {formatDateLabel(tx.occurred_on)}
                {tx.description ? ` · ${tx.description}` : ""}
              </p>
            </div>
            <span
              className={`text-sm font-semibold ${
                tx.type === "income" || isGoalContribution ? "text-income" : "text-textPrimary"
              }`}
            >
              {tx.type === "income" ? "+" : isGoalContribution ? "+" : "-"}
              {formatMoney(tx.amount, tx.currency)}
            </span>
            {onEdit && (
              <button
                onClick={() => onEdit(tx)}
                className="rounded-full p-1.5 text-textSecondary hover:bg-surfaceMuted hover:text-textPrimary"
                aria-label="Редактировать операцию"
              >
                <Pencil size={16} />
              </button>
            )}
            <button
              onClick={() => onDelete(tx.id)}
              className="rounded-full p-1.5 text-textSecondary hover:bg-surfaceMuted hover:text-expense"
              aria-label="Удалить операцию"
            >
              <Trash2 size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
