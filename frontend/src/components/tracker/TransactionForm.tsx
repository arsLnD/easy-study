import { useState, type FormEvent } from "react";
import type { Category, CategoryType } from "@/types";
import { Button } from "@/components/common/Button";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { todayIso } from "@/utils/format";

interface InitialValues {
  type: CategoryType;
  categoryId: string;
  amount: string;
  description: string;
  occurredOn: string;
}

interface Props {
  categories: Category[];
  currency: string;
  defaultDate?: string;
  /** Если передано — форма работает в режиме редактирования существующей операции. */
  initial?: InitialValues;
  submitLabel?: string;
  onSubmit: (payload: {
    category_id: string;
    type: CategoryType;
    amount: string;
    currency: string;
    description?: string;
    occurred_on: string;
  }) => Promise<void>;
}

export function TransactionForm({ categories, currency, defaultDate, initial, submitLabel, onSubmit }: Props) {
  const [type, setType] = useState<CategoryType>(initial?.type ?? "expense");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? "");
  const [amount, setAmount] = useState(initial?.amount ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [occurredOn, setOccurredOn] = useState(initial?.occurredOn ?? defaultDate ?? todayIso());
  const [submitting, setSubmitting] = useState(false);

  const filteredCategories = categories.filter((c) => c.type === type);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const effectiveCategoryId = categoryId || filteredCategories[0]?.id;
    if (!effectiveCategoryId || !amount) return;

    setSubmitting(true);
    try {
      await onSubmit({
        category_id: effectiveCategoryId,
        type,
        amount,
        currency,
        description: description || undefined,
        occurred_on: occurredOn,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex gap-2 rounded-xl border border-border bg-surfaceMuted p-1">
        <button
          type="button"
          onClick={() => setType("expense")}
          disabled={!!initial}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
            type === "expense" ? "bg-expense text-white" : "text-textSecondary"
          }`}
        >
          Трата
        </button>
        <button
          type="button"
          onClick={() => setType("income")}
          disabled={!!initial}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
            type === "income" ? "bg-income text-white" : "text-textSecondary"
          }`}
        >
          Доход
        </button>
      </div>

      <Select label="Категория" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
        <option value="" disabled>
          Выберите категорию
        </option>
        {filteredCategories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {c.linked_goal_id ? " · цель накопления" : ""}
          </option>
        ))}
      </Select>

      <Input
        label="Сумма"
        type="number"
        min={0}
        inputMode="decimal"
        required
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="0"
      />

      <Input
        label="Дата"
        type="date"
        required
        value={occurredOn}
        onChange={(e) => setOccurredOn(e.target.value)}
      />

      <Input
        label="Комментарий (необязательно)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Например: обед с коллегами"
      />

      <Button type="submit" fullWidth disabled={submitting} variant={type === "expense" ? "primary" : "primary"}>
        {submitting ? "Сохраняем..." : submitLabel ?? "Добавить"}
      </Button>
    </form>
  );
}
