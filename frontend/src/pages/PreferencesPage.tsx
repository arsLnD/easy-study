import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/common/Button";
import { Card } from "@/components/common/Card";
import { Input } from "@/components/common/Input";
import { Select } from "@/components/common/Select";
import { updateSettings } from "@/api/users";
import { useAuthStore } from "@/store/authStore";
import type { EntryFrequency } from "@/types";

const CURRENCIES = ["RUB", "USD", "EUR", "KZT", "UAH", "BYN"];

export function PreferencesPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const [currency, setCurrency] = useState(user?.settings?.default_currency ?? "RUB");
  const [entryFrequency, setEntryFrequency] = useState<EntryFrequency>(user?.settings?.entry_frequency ?? "weekly");
  const [customDays, setCustomDays] = useState(user?.settings?.custom_frequency_days ?? 7);
  const [motivational, setMotivational] = useState(user?.settings?.motivational_quotes_enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateSettings({
        default_currency: currency,
        entry_frequency: entryFrequency,
        custom_frequency_days: customDays,
        motivational_quotes_enabled: motivational,
      });
      if (user) setUser({ ...user, settings: updated });
      setMessage("Настройки сохранены");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <TopBar title="Периодичность и вид" back />
      <div className="flex flex-col gap-5 px-5">
        <Card>
          <h2 className="mb-3 text-base font-bold">Валюта по умолчанию</h2>
          <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <p className="mt-2 text-xs text-textSecondary">
            Используется по умолчанию в формах — при этом каждую операцию и цель можно вести в своей валюте.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 text-base font-bold">Как часто вносить траты</h2>
          <Select value={entryFrequency} onChange={(e) => setEntryFrequency(e.target.value as EntryFrequency)}>
            <option value="daily">Каждый день</option>
            <option value="weekly">Каждую неделю</option>
            <option value="custom">Свой интервал</option>
          </Select>
          {entryFrequency === "custom" && (
            <div className="mt-3">
              <Input
                label="Интервал в днях"
                type="number"
                min={1}
                max={90}
                value={customDays}
                onChange={(e) => setCustomDays(Number(e.target.value))}
              />
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold">Мотивационные фразы</h2>
              <p className="text-xs text-textSecondary">Показывать фразу при заходе в трекер</p>
            </div>
            <button
              onClick={() => setMotivational((v) => !v)}
              className={`h-7 w-12 rounded-full transition-colors ${motivational ? "bg-primary" : "bg-surfaceMuted"}`}
            >
              <span
                className={`block h-5 w-5 translate-y-1 rounded-full bg-white transition-transform ${
                  motivational ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </Card>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Сохраняем..." : "Сохранить настройки"}
        </Button>
        {message && <p className="text-center text-sm text-income">{message}</p>}
      </div>
    </AppShell>
  );
}
