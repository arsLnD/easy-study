import { useMemo } from "react";
import type { Transaction } from "@/types";
import { dayIsoOfMonth, daysInMonth, firstWeekdayIndex, isToday } from "@/utils/format";

const WEEKDAY_LABELS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

interface DayInfo {
  iso: string;
  day: number;
  hasIncome: boolean;
  hasExpense: boolean;
}

/**
 * Календарная сетка месяца — по требованию "возможность открыть любой день
 * для просмотра информации". Каждый день кликабелен; точками отмечены дни,
 * где есть доход (зелёная) и/или траты (розовая), чтобы видеть активность
 * за месяц одним взглядом, не открывая каждый день по отдельности.
 */
export function MonthCalendar({
  month,
  transactions,
  selectedDay,
  onSelectDay,
}: {
  month: string;
  transactions: Transaction[];
  selectedDay: string | null;
  onSelectDay: (iso: string) => void;
}) {
  const days = useMemo<DayInfo[]>(() => {
    const total = daysInMonth(month);
    const byDay = new Map<string, { income: boolean; expense: boolean }>();
    for (const tx of transactions) {
      const entry = byDay.get(tx.occurred_on) ?? { income: false, expense: false };
      if (tx.type === "income") entry.income = true;
      else entry.expense = true;
      byDay.set(tx.occurred_on, entry);
    }
    return Array.from({ length: total }, (_, idx) => {
      const day = idx + 1;
      const iso = dayIsoOfMonth(month, day);
      const entry = byDay.get(iso);
      return { iso, day, hasIncome: entry?.income ?? false, hasExpense: entry?.expense ?? false };
    });
  }, [month, transactions]);

  const leadingBlanks = firstWeekdayIndex(month);

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-textSecondary">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: leadingBlanks }).map((_, idx) => <span key={`blank-${idx}`} />)}
        {days.map(({ iso, day, hasIncome, hasExpense }) => {
          const selected = iso === selectedDay;
          const today = isToday(iso);
          return (
            <button
              key={iso}
              onClick={() => onSelectDay(iso)}
              className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 text-sm transition-colors ${
                selected
                  ? "bg-primary text-white font-semibold"
                  : today
                    ? "border border-primary/50 text-textPrimary"
                    : "text-textPrimary hover:bg-surfaceMuted"
              }`}
            >
              <span>{day}</span>
              <span className="flex h-1.5 gap-0.5">
                {hasIncome && <span className="h-1.5 w-1.5 rounded-full bg-income" />}
                {hasExpense && <span className="h-1.5 w-1.5 rounded-full bg-expense" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
