import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { listCategories } from "@/api/categories";
import { listGoals } from "@/api/goals";
import { createTransaction, deleteTransaction, getPeriodSummary, listTransactions } from "@/api/transactions";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/common/Card";
import { Loader } from "@/components/common/Loader";
import { Modal } from "@/components/common/Modal";
import { MotivationalBanner } from "@/components/tracker/MotivationalBanner";
import { PeriodSelector, type PeriodOption } from "@/components/tracker/PeriodSelector";
import { CategorySummaryTable } from "@/components/tracker/CategorySummaryTable";
import { GoalsProgressTable } from "@/components/tracker/GoalsProgressTable";
import { TransactionForm } from "@/components/tracker/TransactionForm";
import { TransactionList } from "@/components/tracker/TransactionList";
import { useAuthStore } from "@/store/authStore";
import type { Category, Goal, PeriodSummary, Transaction } from "@/types";
import { addDaysIso, formatDateLabel, startOfWeekIso } from "@/utils/format";

function computePeriodRange(period: PeriodOption, anchor: Date): { start: string; end: string } {
  if (period === "day") {
    const iso = anchor.toISOString().slice(0, 10);
    return { start: iso, end: iso };
  }
  if (period === "week") {
    const start = startOfWeekIso(anchor);
    return { start, end: addDaysIso(start, 6) };
  }
  const start = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}-01`;
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
}

function shiftAnchor(anchor: Date, period: PeriodOption, delta: number): Date {
  const d = new Date(anchor);
  if (period === "day") d.setDate(d.getDate() + delta);
  if (period === "week") d.setDate(d.getDate() + delta * 7);
  if (period === "month") d.setMonth(d.getMonth() + delta);
  return d;
}

export function TrackerPage() {
  const user = useAuthStore((s) => s.user);
  const defaultPeriod: PeriodOption = user?.settings?.entry_frequency === "daily" ? "day" : "week";

  const [period, setPeriod] = useState<PeriodOption>(defaultPeriod);
  const [anchor, setAnchor] = useState(new Date());
  const [tab, setTab] = useState<"overview" | "transactions">("overview");

  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [summary, setSummary] = useState<PeriodSummary | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const { start, end } = useMemo(() => computePeriodRange(period, anchor), [period, anchor]);
  const currency = user?.settings?.default_currency ?? "RUB";

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

  const periodLabel =
    period === "day"
      ? formatDateLabel(start)
      : `${formatDateLabel(start)} — ${formatDateLabel(end)}`;

  return (
    <AppShell>
      <TopBar title="Трекер трат" subtitle="Заполняйте траты и следите за прогрессом" />
      <MotivationalBanner />

      <div className="px-5">
        <PeriodSelector value={period} onChange={setPeriod} />

        <div className="mt-3 mb-5 flex items-center justify-between rounded-xl2 border border-border bg-surface px-4 py-3">
          <button onClick={() => setAnchor((a) => shiftAnchor(a, period, -1))} className="p-1 text-textSecondary hover:text-textPrimary">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-semibold">{periodLabel}</span>
          <button onClick={() => setAnchor((a) => shiftAnchor(a, period, 1))} className="p-1 text-textSecondary hover:text-textPrimary">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="mb-4 flex gap-2 rounded-xl border border-border bg-surface p-1">
          <button
            onClick={() => setTab("overview")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === "overview" ? "bg-surfaceMuted text-textPrimary" : "text-textSecondary"
            }`}
          >
            Обзор
          </button>
          <button
            onClick={() => setTab("transactions")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === "transactions" ? "bg-surfaceMuted text-textPrimary" : "text-textSecondary"
            }`}
          >
            Операции
          </button>
        </div>

        {loading ? (
          <Loader />
        ) : tab === "overview" ? (
          <div className="flex flex-col gap-5">
            <Card>
              <h2 className="mb-3 text-base font-bold">План / факт по категориям</h2>
              {summary && <CategorySummaryTable items={summary.categories} currency={summary.currency} />}
            </Card>
            <Card>
              <h2 className="mb-3 text-base font-bold">Мои цели</h2>
              <GoalsProgressTable goals={goals} />
            </Card>
          </div>
        ) : (
          <Card>
            <TransactionList transactions={transactions} onDelete={handleDeleteTransaction} />
          </Card>
        )}
      </div>

      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full
          bg-primary text-white shadow-glow transition-transform active:scale-95"
        aria-label="Добавить операцию"
      >
        <Plus size={26} />
      </button>

      {modalOpen && (
        <Modal title="Новая операция" onClose={() => setModalOpen(false)}>
          <TransactionForm categories={categories} currency={currency} onSubmit={handleAddTransaction} />
        </Modal>
      )}
    </AppShell>
  );
}
