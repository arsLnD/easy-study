/** Форматирование денежных сумм и дат — используется по всему приложению. */

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: "₽",
  USD: "$",
  EUR: "€",
  KZT: "₸",
  UAH: "₴",
  BYN: "Br",
};

export function formatMoney(value: string | number, currency = "RUB"): string {
  const numeric = typeof value === "string" ? parseFloat(value) : value;
  const formatted = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
  }).format(Math.round(numeric));
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${formatted} ${symbol}`;
}

export function currencySymbol(currency = "RUB"): string {
  return CURRENCY_SYMBOLS[currency] ?? currency;
}

/**
 * "Сегодня" в ЛОКАЛЬНОЙ дате пользователя. Намеренно не используем
 * new Date().toISOString() — оно всегда конвертирует в UTC, и для
 * пользователей с положительным смещением от UTC (например, Москва, UTC+3)
 * в первые часы после полуночи это даёт ВЧЕРАШНЮЮ дату вместо сегодняшней.
 */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function firstDayOfMonthIso(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function formatMonthLabel(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(d);
}

export function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(d);
}

export function formatDateLabelFull(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", weekday: "long" }).format(d);
}

/** Сколько дней в месяце, заданном ISO-строкой первого числа ("2026-08-01"). */
export function daysInMonth(monthIso: string): number {
  const d = new Date(monthIso);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/** ISO-дата N-го числа месяца, заданного monthIso (первым числом месяца). */
export function dayIsoOfMonth(monthIso: string, day: number): string {
  const d = new Date(monthIso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Индекс дня недели для 1-го числа месяца, 0 = понедельник ... 6 = воскресенье. */
export function firstWeekdayIndex(monthIso: string): number {
  const d = new Date(monthIso);
  const jsDay = d.getDay(); // 0 = воскресенье
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function isToday(iso: string): boolean {
  return iso === todayIso();
}
