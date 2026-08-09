import { useEffect, useState, type FormEvent } from "react";
import { PiggyBank, Pencil, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { Input } from "@/components/common/Input";
import { Modal } from "@/components/common/Modal";
import { ProgressBar } from "@/components/common/ProgressBar";
import { createGoal, deleteGoal, listGoals, updateGoal } from "@/api/goals";
import { createTransaction } from "@/api/transactions";
import { useAuthStore } from "@/store/authStore";
import type { Goal } from "@/types";
import { formatMoney, todayIso } from "@/utils/format";

const GOAL_ICONS = ["target", "plane", "gift", "home", "car", "laptop"];
const COLOR_PALETTE = ["#00E38C", "#7C5CFF", "#FF5470", "#FFB020", "#5C8DFF", "#2FD1C5"];

export function GoalsPage() {
  const user = useAuthStore((s) => s.user);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [contributeGoal, setContributeGoal] = useState<Goal | null>(null);

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [icon, setIcon] = useState(GOAL_ICONS[0]);
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [saving, setSaving] = useState(false);

  const [contributeAmount, setContributeAmount] = useState("");
  const [contributeDate, setContributeDate] = useState(todayIso());
  const [contributeNote, setContributeNote] = useState("");
  const [contributing, setContributing] = useState(false);

  async function refresh() {
    setLoading(true);
    setGoals(await listGoals());
    setLoading(false);
  }

  useEffect(() => {
    refresh();
  }, []);

  function openCreateModal() {
    setEditingGoal(null);
    setName("");
    setTargetAmount("");
    setDeadline("");
    setIcon(GOAL_ICONS[0]);
    setColor(COLOR_PALETTE[0]);
    setModalOpen(true);
  }

  function openEditModal(goal: Goal) {
    setEditingGoal(goal);
    setName(goal.name);
    setTargetAmount(goal.target_amount);
    setDeadline(goal.deadline ?? "");
    setIcon(goal.icon);
    setColor(goal.color);
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !targetAmount) return;
    setSaving(true);
    try {
      if (editingGoal) {
        await updateGoal(editingGoal.id, {
          name: name.trim(),
          icon,
          color,
          target_amount: targetAmount,
          deadline: deadline || null,
        });
      } else {
        await createGoal({
          name: name.trim(),
          icon,
          color,
          currency: user?.settings?.default_currency ?? "RUB",
          target_amount: targetAmount,
          deadline: deadline || null,
        });
      }
      setModalOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteGoal(id);
    await refresh();
  }

  function openContributeModal(goal: Goal) {
    setContributeGoal(goal);
    setContributeAmount("");
    setContributeDate(todayIso());
    setContributeNote("");
  }

  async function handleContribute(e: FormEvent) {
    e.preventDefault();
    if (!contributeGoal?.category_id || !contributeAmount) return;
    setContributing(true);
    try {
      // Пополнение цели — обычная трата (Transaction) в её служебной
      // категории: она попадёт в общий список операций и учтётся в
      // сводке "план vs факт", а не будет отдельной "статьёй вне плана".
      await createTransaction({
        category_id: contributeGoal.category_id,
        type: "expense",
        amount: contributeAmount,
        currency: contributeGoal.currency,
        description: contributeNote || undefined,
        occurred_on: contributeDate,
      });
      setContributeGoal(null);
      await refresh();
    } finally {
      setContributing(false);
    }
  }

  return (
    <AppShell>
      <TopBar title="Мои цели" back />
      <div className="flex flex-col gap-4 px-5">
        {loading ? (
          <p className="py-6 text-center text-sm text-textSecondary">Загрузка...</p>
        ) : goals.length === 0 ? (
          <p className="py-6 text-center text-sm text-textSecondary">
            У вас пока нет целей. Добавьте первую — например, «Подушка безопасности» или «Отпуск».
          </p>
        ) : (
          goals.map((goal) => (
            <Card key={goal.id}>
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${goal.color}22`, color: goal.color }}
                >
                  <CategoryIcon name={goal.icon} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">
                    {goal.name}
                    {goal.status === "completed" && <span className="ml-1.5 text-xs text-income">достигнута!</span>}
                  </p>
                  <p className="text-xs text-textSecondary">
                    {formatMoney(goal.current_amount, goal.currency)} из{" "}
                    {formatMoney(goal.target_amount, goal.currency)}
                    {goal.deadline ? ` · до ${new Date(goal.deadline).toLocaleDateString("ru-RU")}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => openEditModal(goal)}
                  className="rounded-full p-1.5 text-textSecondary hover:bg-surfaceMuted hover:text-textPrimary"
                  aria-label="Редактировать цель"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="rounded-full p-1.5 text-textSecondary hover:bg-surfaceMuted hover:text-expense"
                  aria-label="Удалить цель"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-3">
                <ProgressBar percent={goal.progress_percent} color={goal.color} />
              </div>
              <Button
                variant="secondary"
                className="mt-3"
                fullWidth
                onClick={() => openContributeModal(goal)}
                disabled={!goal.category_id}
              >
                <PiggyBank size={16} />
                Пополнить
              </Button>
            </Card>
          ))
        )}

        <Button variant="secondary" onClick={openCreateModal}>
          <Plus size={16} />
          Новая цель
        </Button>
      </div>

      {modalOpen && (
        <Modal title={editingGoal ? "Изменить цель" : "Новая цель"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Название цели" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            <Input
              label="Сумма цели"
              type="number"
              min={0}
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              required
            />
            <Input
              label="Срок (необязательно)"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-textSecondary">Иконка</p>
              <div className="flex flex-wrap gap-2">
                {GOAL_ICONS.map((i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setIcon(i)}
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
                      icon === i ? "border-primary bg-primary/15 text-primary" : "border-border text-textSecondary"
                    }`}
                  >
                    <CategoryIcon name={i} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-textSecondary">Цвет</p>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-9 w-9 rounded-full"
                    style={{
                      backgroundColor: c,
                      outline: color === c ? "2px solid white" : "none",
                    }}
                  />
                ))}
              </div>
            </div>
            <Button type="submit" disabled={saving}>
              {saving ? "Сохраняем..." : editingGoal ? "Сохранить изменения" : "Создать цель"}
            </Button>
          </form>
        </Modal>
      )}

      {contributeGoal && (
        <Modal title={`Пополнить «${contributeGoal.name}»`} onClose={() => setContributeGoal(null)}>
          <form onSubmit={handleContribute} className="flex flex-col gap-4">
            <Input
              label="Сумма"
              type="number"
              min={0}
              inputMode="decimal"
              required
              autoFocus
              value={contributeAmount}
              onChange={(e) => setContributeAmount(e.target.value)}
              placeholder="0"
            />
            <Input
              label="Дата"
              type="date"
              required
              value={contributeDate}
              onChange={(e) => setContributeDate(e.target.value)}
            />
            <Input
              label="Комментарий (необязательно)"
              value={contributeNote}
              onChange={(e) => setContributeNote(e.target.value)}
              placeholder="Например: премия"
            />
            <Button type="submit" fullWidth disabled={contributing}>
              {contributing ? "Сохраняем..." : "Пополнить"}
            </Button>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}
