import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { listCategories } from "@/api/categories";
import { listAllContributions, listGoals } from "@/api/goals";
import { createTransaction, deleteTransaction, getPeriodSummary, listTransactions } from "@/api/transactions";
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

/**
 * Экран "Трекер" — работает только на дистанции месяца (по требованию:
 * базовый режим = сводка план/факт за текущий месяц), но позволяет вносить
 * операции и открывать любой конкретный день внутри месяца (вкладка "По
 * дням"), а также смотреть накопления по целям (вкладка "Накопления").
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
  const [contributions, setContributions] = useState<GoalContributionWithGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [addDefaultDate, setAddDefaultDate] = useState(todayIso());

  const { start, end } = useMemo(() => monthRange(month), [month]);

  async function refresh() {
    setLoading(true);
    const [cats, goalsList, periodSummary, txs, contribs] = await Promise.all([
      listCategories(),
      listGoals(),
      getPeriodSummary(start, end),
      listTransactions({ date_from: start, date_to: end }),
      listAllContributions(start, end),
    ]);
    setCategories(cats);
    setGoals(goalsList);
    setSummary(periodSummary);
    setTransactions(txs);
    setContributions(contribs);
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

  async function handleDeleteTransaction(id: string) {
    await deleteTransaction(id);
    await refresh();
  }

  function openAddModal(defaultDate?: string) {
    setAddDefaultDate(defaultDate ?? todayIso());
    setModalOpen(true);
  }

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
            <TransactionList transactions={transactions} onDelete={handleDeleteTransaction} />
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
    </AppShell>
  );
}
