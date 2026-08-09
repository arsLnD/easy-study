import { Plus } from "lucide-react";
import type { Transaction } from "@/types";
import { Button } from "@/components/common/Button";
import { TransactionList } from "@/components/tracker/TransactionList";
import { formatDateLabelFull, formatMoney } from "@/utils/format";

/**
 * Детальная карточка выбранного дня в разделе "По дням" — показывает все
 * операции этого конкретного дня и позволяет сразу добавить новую с
 * предзаполненной датой этого дня.
 */
export function DayDetailCard({
  dayIso,
  transactions,
  currency,
  onDelete,
  onEdit,
  onAddForDay,
}: {
  dayIso: string;
  transactions: Transaction[];
  currency: string;
  onDelete: (id: string) => void;
  onEdit: (transaction: Transaction) => void;
  onAddForDay: (dayIso: string) => void;
}) {
  const dayTransactions = transactions.filter((tx) => tx.occurred_on === dayIso);
  const income = dayTransactions.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
  const expense = dayTransactions.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + parseFloat(tx.amount), 0);

  return (
    <div className="mt-4 rounded-xl2 border border-border bg-surfaceMuted/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold capitalize">{formatDateLabelFull(dayIso)}</h3>
        <button
          onClick={() => onAddForDay(dayIso)}
          className="flex items-center gap-1 rounded-lg bg-primary/15 px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25"
        >
          <Plus size={14} /> Добавить
        </button>
      </div>

      {dayTransactions.length > 0 && (
        <div className="mb-3 flex gap-4 text-xs">
          <span className="text-income">+{formatMoney(income, currency)}</span>
          <span className="text-expense">-{formatMoney(expense, currency)}</span>
        </div>
      )}

      <TransactionList transactions={dayTransactions} onDelete={onDelete} onEdit={onEdit} />
    </div>
  );
}
