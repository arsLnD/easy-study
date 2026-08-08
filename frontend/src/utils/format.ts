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

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function firstDayOfMonthIso(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

export function startOfWeekIso(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay() === 0 ? 7 : d.getDay(); // считаем неделю с понедельника
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatMonthLabel(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" }).format(d);
}

export function formatDateLabel(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(d);
}
