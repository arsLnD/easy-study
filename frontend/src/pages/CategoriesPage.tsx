import { useEffect, useState, type FormEvent } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { Input } from "@/components/common/Input";
import { Modal } from "@/components/common/Modal";
import { createCategory, deleteCategory, listCategories } from "@/api/categories";
import type { Category, CategoryType } from "@/types";

const COLOR_PALETTE = ["#7C5CFF", "#00E38C", "#FF5470", "#FFB020", "#5C8DFF", "#2FD1C5", "#FF8AD8", "#8A8F98"];

export function CategoriesPage() {
  const [type, setType] = useState<CategoryType>("expense");
  const [categories, setCategories] = useState<Category[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [isEssential, setIsEssential] = useState(false);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setCategories(await listCategories());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await createCategory({ name: name.trim(), type, color, icon: "tag", is_essential: isEssential });
      setName("");
      setIsEssential(false);
      setModalOpen(false);
      await refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteCategory(id);
    await refresh();
  }

  const filtered = categories.filter((c) => c.type === type);

  return (
    <AppShell>
      <TopBar title="Категории" back />
      <div className="flex flex-col gap-4 px-5">
        <div className="flex gap-2 rounded-xl border border-border bg-surface p-1">
          <button
            onClick={() => setType("expense")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${type === "expense" ? "bg-surfaceMuted text-textPrimary" : "text-textSecondary"}`}
          >
            Траты
          </button>
          <button
            onClick={() => setType("income")}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${type === "income" ? "bg-surfaceMuted text-textPrimary" : "text-textSecondary"}`}
          >
            Доходы
          </button>
        </div>

        <Card className="divide-y divide-border/60 p-0">
          {filtered.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3.5">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${c.color}22`, color: c.color }}
              >
                <CategoryIcon name={c.icon} size={16} />
              </div>
              <span className="flex-1 text-sm font-medium">{c.name}</span>
              {c.is_preset ? (
                <Lock size={16} className="text-textSecondary" />
              ) : (
                <button
                  onClick={() => handleDelete(c.id)}
                  className="rounded-full p-1.5 text-textSecondary hover:bg-surfaceMuted hover:text-expense"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
        </Card>

        <Button variant="secondary" onClick={() => setModalOpen(true)}>
          <Plus size={16} />
          Добавить свою категорию
        </Button>
      </div>

      {modalOpen && (
        <Modal title="Новая категория" onClose={() => setModalOpen(false)}>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <Input label="Название" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            <div>
              <p className="mb-2 text-sm font-medium text-textSecondary">Цвет</p>
              <div className="flex flex-wrap gap-2">
                {COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className="h-9 w-9 rounded-full transition-transform"
                    style={{
                      backgroundColor: c,
                      outline: color === c ? "2px solid white" : "none",
                      transform: color === c ? "scale(1.1)" : "scale(1)",
                    }}
                  />
                ))}
              </div>
            </div>
            {type === "expense" && (
              <label className="flex items-center gap-2 text-sm text-textSecondary">
                <input type="checkbox" checked={isEssential} onChange={(e) => setIsEssential(e.target.checked)} />
                Это обязательная трата (жильё, еда и т.п.)
              </label>
            )}
            <Button type="submit" disabled={saving}>
              {saving ? "Сохраняем..." : "Добавить"}
            </Button>
          </form>
        </Modal>
      )}
    </AppShell>
  );
}
