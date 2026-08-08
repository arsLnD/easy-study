import { Trash2 } from "lucide-react";
import type { Transaction } from "@/types";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { formatDateLabel, formatMoney } from "@/utils/format";

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => void;
}

export function TransactionList({ transactions, onDelete }: Props) {
  if (transactions.length === 0) {
    return <p className="py-6 text-center text-sm text-textSecondary">Записей за этот период пока нет.</p>;
  }

  return (
    <div className="flex flex-col divide-y divide-border/60">
      {transactions.map((tx) => (
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
            <p className="text-sm font-medium">{tx.category?.name ?? "Без категории"}</p>
            <p className="text-xs text-textSecondary">
              {formatDateLabel(tx.occurred_on)}
              {tx.description ? ` · ${tx.description}` : ""}
            </p>
          </div>
          <span className={`text-sm font-semibold ${tx.type === "income" ? "text-income" : "text-textPrimary"}`}>
            {tx.type === "income" ? "+" : "-"}
            {formatMoney(tx.amount, tx.currency)}
          </span>
          <button
            onClick={() => onDelete(tx.id)}
            className="rounded-full p-1.5 text-textSecondary hover:bg-surfaceMuted hover:text-expense"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
