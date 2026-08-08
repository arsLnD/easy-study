import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { listCategories } from "@/api/categories";
import { listGoals } from "@/api/goals";
import { getPlanForMonth, getRecommendation, upsertPlan } from "@/api/plans";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Loader } from "@/components/common/Loader";
import { CategoryAllocationRow } from "@/components/plan/CategoryAllocationRow";
import { GoalAllocationRow } from "@/components/plan/GoalAllocationRow";
import { TopBar } from "@/components/layout/TopBar";
import { AppShell } from "@/components/layout/AppShell";
import { useAuthStore } from "@/store/authStore";
import type { Category, Goal, RecommendationResponse } from "@/types";
import { formatMoney, formatMonthLabel } from "@/utils/format";

function shiftMonth(monthIso: string, delta: number): string {
  const d = new Date(monthIso);
  d.setMonth(d.getMonth() + delta);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export function PlanPage() {
  const user = useAuthStore((s) => s.user);
  const currency = user?.settings?.default_currency ?? "RUB";

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });

  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [totalIncome, setTotalIncome] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [goalAllocations, setGoalAllocations] = useState<Record<string, string>>({});
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recLoading, setRecLoading] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setRecommendation(null);
    setSavedMessage(null);

    Promise.all([listCategories("expense"), listGoals(), getPlanForMonth(month)]).then(
      ([cats, goalsList, plan]) => {
        if (!active) return;
        setCategories(cats);
        setGoals(goalsList.filter((g) => g.status !== "archived"));

        if (plan) {
          setTotalIncome(plan.total_income);
          const allocMap: Record<string, string> = {};
          plan.allocations.forEach((a) => (allocMap[a.category_id] = a.planned_amount));
          setAllocations(allocMap);
          const goalMap: Record<string, string> = {};
          plan.goal_contributions.forEach((gc) => (goalMap[gc.goal_id] = gc.amount));
          setGoalAllocations(goalMap);
        } else {
          setTotalIncome("");
          setAllocations({});
          setGoalAllocations({});
        }
        setLoading(false);
      }
    );

    return () => {
      active = false;
    };
  }, [month]);

  const totalAllocated = useMemo(
    () => Object.values(allocations).reduce((sum, v) => sum + (parseFloat(v) || 0), 0),
    [allocations]
  );
  const totalGoalAllocated = useMemo(
    () => Object.values(goalAllocations).reduce((sum, v) => sum + (parseFloat(v) || 0), 0),
    [goalAllocations]
  );
  const income = parseFloat(totalIncome) || 0;
  const remaining = income - totalAllocated - totalGoalAllocated;

  async function handleGetRecommendation() {
    if (!income) return;
    setRecLoading(true);
    try {
      const rec = await getRecommendation(String(income), month);
      setRecommendation(rec);

      const newAllocations: Record<string, string> = { ...allocations };
      rec.items.forEach((item) => {
        newAllocations[item.category_id] = item.suggested_amount;
      });
      setAllocations(newAllocations);

      // Предложенные сбережения распределяем пропорционально между активными
      // целями, которым ещё не хватает суммы до цели.
      const activeGoals = goals.filter((g) => g.status === "active");
      const remainingNeeded = activeGoals.map((g) =>
        Math.max(0, parseFloat(g.target_amount) - parseFloat(g.current_amount))
      );
      const totalNeeded = remainingNeeded.reduce((a, b) => a + b, 0);
      const savingsTotal = parseFloat(rec.savings_total);

      if (totalNeeded > 0 && savingsTotal > 0) {
        const newGoalAllocations: Record<string, string> = { ...goalAllocations };
        activeGoals.forEach((g, idx) => {
          const share = (remainingNeeded[idx] / totalNeeded) * savingsTotal;
          newGoalAllocations[g.id] = share.toFixed(0);
        });
        setGoalAllocations(newGoalAllocations);
      }
    } finally {
      setRecLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSavedMessage(null);
    try {
      await upsertPlan({
        month,
        currency,
        total_income: String(income),
        allocations: Object.entries(allocations)
          .filter(([, v]) => parseFloat(v) > 0)
          .map(([category_id, planned_amount]) => ({ category_id, planned_amount })),
        goal_contributions: Object.entries(goalAllocations)
          .filter(([, v]) => parseFloat(v) > 0)
          .map(([goal_id, amount]) => ({ goal_id, amount })),
      });
      setSavedMessage("План сохранён!");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <TopBar title="Мой план" subtitle="Планирование бюджета на месяц" />

      <div className="px-5">
        <div className="mb-5 flex items-center justify-between rounded-xl2 border border-border bg-surface px-4 py-3">
          <button onClick={() => setMonth((m) => shiftMonth(m, -1))} className="p-1 text-textSecondary hover:text-textPrimary">
            <ChevronLeft size={20} />
          </button>
          <span className="text-sm font-semibold capitalize">{formatMonthLabel(month)}</span>
          <button onClick={() => setMonth((m) => shiftMonth(m, 1))} className="p-1 text-textSecondary hover:text-textPrimary">
            <ChevronRight size={20} />
          </button>
        </div>

        {loading ? (
          <Loader />
        ) : (
          <div className="flex flex-col gap-5">
            <Card>
              <label className="mb-2 block text-sm font-medium text-textSecondary">
                Ожидаемый доход за месяц
              </label>
              <input
                type="number"
                min={0}
                inputMode="decimal"
                value={totalIncome}
                onChange={(e) => setTotalIncome(e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-border bg-surfaceMuted px-4 py-3 text-2xl font-bold
                  outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
              <Button
                variant="secondary"
                className="mt-3"
                fullWidth
                onClick={handleGetRecommendation}
                disabled={!income || recLoading}
              >
                <Sparkles size={16} />
                {recLoading ? "Считаем..." : "Помочь распределить бюджет"}
              </Button>
              {recommendation && (
                <p className="mt-3 text-xs leading-relaxed text-textSecondary">{recommendation.explanation}</p>
              )}
            </Card>

            <Card>
              <h2 className="mb-1 text-base font-bold">Траты по категориям</h2>
              <p className="mb-2 text-xs text-textSecondary">
                Сколько планируете потратить в каждой категории
              </p>
              <div className="divide-y divide-border/60">
                {categories.map((category) => (
                  <CategoryAllocationRow
                    key={category.id}
                    category={category}
                    currency={currency}
                    value={allocations[category.id] ?? ""}
                    onChange={(v) => setAllocations((prev) => ({ ...prev, [category.id]: v }))}
                  />
                ))}
              </div>
            </Card>

            <Card>
              <h2 className="mb-1 text-base font-bold">Отчисления на цели</h2>
              <p className="mb-2 text-xs text-textSecondary">
                Сколько отложить в этом месяце на каждую цель
              </p>
              {goals.length === 0 ? (
                <p className="py-3 text-sm text-textSecondary">
                  У вас пока нет целей. Добавьте их в разделе «Настройки → Цели».
                </p>
              ) : (
                <div className="divide-y divide-border/60">
                  {goals.map((goal) => (
                    <GoalAllocationRow
                      key={goal.id}
                      goal={goal}
                      value={goalAllocations[goal.id] ?? ""}
                      onChange={(v) => setGoalAllocations((prev) => ({ ...prev, [goal.id]: v }))}
                    />
                  ))}
                </div>
              )}
            </Card>

            <Card className={remaining < 0 ? "border-expense/60" : "border-income/40"}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-textSecondary">Доход</span>
                <span className="font-semibold">{formatMoney(income, currency)}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-sm">
                <span className="text-textSecondary">Траты + цели</span>
                <span className="font-semibold">{formatMoney(totalAllocated + totalGoalAllocated, currency)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="font-semibold">Свободный остаток</span>
                <span className={`font-bold ${remaining < 0 ? "text-expense" : "text-income"}`}>
                  {formatMoney(remaining, currency)}
                </span>
              </div>
              {remaining < 0 && (
                <p className="mt-2 text-xs text-expense">
                  План превышает доход. Уменьшите траты или увеличьте доход.
                </p>
              )}
            </Card>

            <Button onClick={handleSave} disabled={saving} fullWidth>
              {saving ? "Сохраняем..." : "Сохранить план"}
            </Button>
            {savedMessage && <p className="text-center text-sm text-income">{savedMessage}</p>}
          </div>
        )}
      </div>
    </AppShell>
  );
}
