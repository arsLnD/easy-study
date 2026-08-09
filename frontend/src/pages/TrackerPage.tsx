import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Plus } from "lucide-react";
import { listCategories } from "@/api/categories";
import { listGoals } from "@/api/goals";
import {
  createTransaction,
  deleteTransaction,
  getPeriodSummary,
  listTransactions,
  updateTransaction,
} from "@/api/transactions";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/common/Card";
import { Loader } from "@/components/common/Loader";
import { Modal } from "@/components/common/Modal";
import { ContributionsList } from "@/components/tracker/ContributionsList";
import { DayDetailCard } from "@/components/tracker/DayDetailCard";
import { MonthCalendar } from "@/components/tracker/MonthCalendar";
import { MotivationalBanner } from "@/components/tracker/MotivationalBanner";
import { CategorySummaryTable } from "@/components/tracker/CategorySummaryTable";
import { GoalsProgressTable } from "@/components/tracker/GoalsProgressTable";
import { TransactionForm } from "@/components/tracker/TransactionForm";
import { TransactionList } from "@/components/tracker/TransactionList";
import { useAuthStore } from "@/store/authStore";
import type { Category, Goal, GoalContributionWithGoal, PeriodSummary, Transaction } from "@/types";
import { formatMoney, formatMonthLabel, todayIso } from "@/utils/format";

type Tab = "overview" | "days" | "savings" | "transactions";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Обзор" },
  { id: "days", label: "По дням" },
  { id: "savings", label: "Накопления" },
  { id: "transactions", label: "Операции" },
];

function monthRange(monthIso: string): { start: string; end: string } {
  const d = new Date(monthIso);
  const year = d.getFullYear();
  const monthIndex = d.getMonth();
  const start = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  // Не используем .toISOString() здесь — оно конвертирует в UTC и в
  // положительных часовых поясах может "откусить" последний день месяца.
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const end = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

function shiftMonth(monthIso: string, delta: number): string {
  const d = new Date(monthIso);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Экспорт операций месяца в CSV — можно открыть в Excel/Google Таблицах. */
function exportTransactionsToCsv(transactions: Transaction[], monthLabel: string) {
  const header = ["Дата", "Тип", "Категория", "Сумма", "Валюта", "Комментарий"];
  const rows = transactions.map((tx) => [
    tx.occurred_on,
    tx.type === "income" ? "Доход" : "Трата",
    tx.category?.name ?? "",
    tx.amount,
    tx.currency,
    tx.description ?? "",
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `operations-${monthLabel}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Экран "Трекер" — работает только на дистанции месяца (по требованию:
 * базовый режим = сводка план/факт за текущий месяц), но позволяет вносить
 * операции и открывать любой конкретный день внутри месяца (вкладка "По
 * дням"), а также смотреть накопления по целям (вкладка "Накопления").
 *
 * Пополнение цели — это обычная Transaction в служебной категории цели
 * (Category.linked_goal_id), поэтому "Накопления" ничего не запрашивает
 * отдельно у API — вкладка просто фильтрует уже загруженный список операций.
 */
export function TrackerPage() {
  const user = useAuthStore((s) => s.user);
  const currency = user?.settings?.default_currency ?? "RUB";

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [addDefaultDate, setAddDefaultDate] = useState(todayIso());
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const { start, end } = useMemo(() => monthRange(month), [month]);

  async function refresh() {
    setLoading(true);
    const [cats, goalsList, periodSummary, txs] = await Promise.all([
      listCategories(),
      listGoals(),
      getPeriodSummary(start, end),
      listTransactions({ date_from: start, date_to: end }),
    ]);
    setCategories(cats);
    setGoals(goalsList);
    setSummary(periodSummary);
    setTransactions(txs);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    setSelectedDay(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, end]);

  async function handleAddTransaction(payload: Parameters<typeof createTransaction>[0]) {
    await createTransaction(payload);
    setModalOpen(false);
    await refresh();
  }

  async function handleUpdateTransaction(payload: Parameters<typeof createTransaction>[0]) {
    if (!editingTransaction) return;
    await updateTransaction(editingTransaction.id, {
      category_id: payload.category_id,
      amount: payload.amount,
      description: payload.description ?? null,
      occurred_on: payload.occurred_on,
    });
    setEditingTransaction(null);
    await refresh();
  }

  async function handleDeleteTransaction(id: string) {
    await deleteTransaction(id);
    await refresh();
  }

  function openAddModal(defaultDate?: string) {
    setAddDefaultDate(defaultDate ?? todayIso());
    setModalOpen(true);
  }

  // Пополнения целей — это транзакции в категориях с linked_goal_id. Строим
  // их отдельным списком для вкладки "Накопления", не делая лишних запросов.
  const goalByCategoryId = useMemo(() => {
    const map = new Map<string, Goal>();
    goals.forEach((g) => {
      if (g.category_id) map.set(g.category_id, g);
    });
    return map;
  }, [goals]);

  const contributions: GoalContributionWithGoal[] = useMemo(() => {
    return transactions
      .filter((tx) => tx.category?.linked_goal_id)
      .map((tx) => {
        const goal = goalByCategoryId.get(tx.category_id);
        return {
          id: tx.id,
          amount: tx.amount,
          contributed_on: tx.occurred_on,
          note: tx.description,
          goal_id: goal?.id ?? tx.category_id,
          goal_name: goal?.name ?? tx.category?.name ?? "Цель",
          goal_icon: goal?.icon ?? tx.category?.icon ?? "target",
          goal_color: goal?.color ?? tx.category?.color ?? "#00E38C",
        };
      })
      .sort((a, b) => (a.contributed_on < b.contributed_on ? 1 : -1));
  }, [transactions, goalByCategoryId]);

  const plannedIncome = parseFloat(summary?.total_income ?? "0");
  const actualIncome = parseFloat(summary?.total_income_actual ?? "0");
  const plannedExpense = parseFloat(summary?.total_planned ?? "0");
  const actualExpense = parseFloat(summary?.total_actual ?? "0");
  const totalContributedThisMonth = contributions.reduce((sum, c) => sum + parseFloat(c.amount), 0);

  return (
    <AppShell>
      <TopBar title="Трекер трат" subtitle="Заполняйте траты и следите за прогрессом" />
      <MotivationalBanner />

      <div className="px-5">
        <div className="mb-4 flex items-center justify-between rounded-xl2 border border-border bg-surface px-4 py-3">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="p-1 text-textSecondary hover:text-textPrimary">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-semibold capitalize">{formatMonthLabel(month)}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="p-1 text-textSecondary hover:text-textPrimary">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 whitespace-nowrap rounded-lg px-2 py-2 text-xs font-medium transition-colors sm:text-sm ${
                tab === id ? "bg-surfaceMuted text-textPrimary" : "text-textSecondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <Loader />
        ) : tab === "overview" ? (
          <div className="flex flex-col gap-5">
            <Card>
              <h2 className="mb-3 text-base font-bold">Сводка за месяц</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-textSecondary">Доход</p>
                  <p className="font-semibold text-income">{formatMoney(actualIncome, currency)}</p>
                  {plannedIncome > 0 && (
                    <p className="text-xs text-textSecondary">план {formatMoney(plannedIncome, currency)}</p>
                  )}
                </div>
                <div>
                  <p className="text-textSecondary">Траты</p>
                  <p className="font-semibold text-expense">{formatMoney(actualExpense, currency)}</p>
                  {plannedExpense > 0 && (
                    <p className="text-xs text-textSecondary">план {formatMoney(plannedExpense, currency)}</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-sm">
                <span className="font-semibold">Остаток</span>
                <span className={`font-bold ${actualIncome - actualExpense < 0 ? "text-expense" : "text-income"}`}>
                  {formatMoney(actualIncome - actualExpense, currency)}
                </span>
              </div>
            </Card>
            <Card>
              <h2 className="mb-3 text-base font-bold">План / факт по категориям</h2>
              {summary && <CategorySummaryTable items={summary.categories} currency={summary.currency} />}
            </Card>
          </div>
        ) : tab === "days" ? (
          <Card>
            <MonthCalendar
              month={month}
              transactions={transactions}
              selectedDay={selectedDay}
              onSelectDay={(iso) => setSelectedDay((prev) => (prev === iso ? null : iso))}
            />
            {selectedDay && (
              <DayDetailCard
                dayIso={selectedDay}
                transactions={transactions}
                currency={currency}
                onDelete={handleDeleteTransaction}
                onEdit={setEditingTransaction}
                onAddForDay={openAddModal}
              />
            )}
          </Card>
        ) : tab === "savings" ? (
          <div className="flex flex-col gap-5">
            <Card>
              <h2 className="mb-1 text-base font-bold">Отложено в этом месяце</h2>
              <p className="text-2xl font-extrabold text-income">
                {formatMoney(totalContributedThisMonth, currency)}
              </p>
            </Card>
            <Card>
              <h2 className="mb-3 text-base font-bold">Мои цели</h2>
              <GoalsProgressTable goals={goals} />
            </Card>
            <Card>
              <h2 className="mb-3 text-base font-bold">История пополнений</h2>
              <ContributionsList contributions={contributions} currency={currency} />
            </Card>
          </div>
        ) : (
          <Card>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base font-bold">Все операции</h2>
              {transactions.length > 0 && (
                <button
                  onClick={() => exportTransactionsToCsv(transactions, month)}
                  className="flex items-center gap-1 rounded-lg bg-surfaceMuted px-2.5 py-1.5 text-xs font-semibold
                    text-textSecondary hover:text-textPrimary"
                >
                  <Download size={14} /> CSV
                </button>
              )}
            </div>
            <TransactionList
              transactions={transactions}
              onDelete={handleDeleteTransaction}
              onEdit={setEditingTransaction}
            />
          </Card>
        )}
      </div>

      <button
        onClick={() => openAddModal()}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full
          bg-primary text-white shadow-glow transition-transform active:scale-95"
        aria-label="Добавить операцию"
      >
        <Plus size={26} />
      </button>

      {modalOpen && (
        <Modal title="Новая операция" onClose={() => setModalOpen(false)}>
          <TransactionForm
            categories={categories}
            currency={currency}
            defaultDate={addDefaultDate}
            onSubmit={handleAddTransaction}
          />
        </Modal>
      )}

      {editingTransaction && (
        <Modal title="Изменить операцию" onClose={() => setEditingTransaction(null)}>
          <TransactionForm
            categories={categories}
            currency={editingTransaction.currency}
            submitLabel="Сохранить изменения"
            initial={{
              type: editingTransaction.type,
              categoryId: editingTransaction.category_id,
              amount: editingTransaction.amount,
              description: editingTransaction.description ?? "",
              occurredOn: editingTransaction.occurred_on,
            }}
            onSubmit={handleUpdateTransaction}
          />
        </Modal>
      )}
    </AppShell>
  );
}
