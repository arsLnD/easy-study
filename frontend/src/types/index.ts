/**
 * TypeScript-типы, зеркалирующие Pydantic-схемы backend'а (backend/app/schemas).
 * Поддерживать их синхронно вручную — осознанный выбор для простоты; при
 * росте проекта имеет смысл генерировать их автоматически из OpenAPI-схемы
 * FastAPI (`openapi-typescript`).
 */

export type EntryFrequency = "daily" | "weekly" | "custom";
export type CategoryType = "expense" | "income";
export type GoalStatus = "active" | "completed" | "archived";

export interface UserSettings {
  id: string;
  default_currency: string;
  entry_frequency: EntryFrequency;
  custom_frequency_days: number;
  motivational_quotes_enabled: boolean;
  theme: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  settings: UserSettings | null;
}

export interface Category {
  id: string;
  user_id: string | null;
  name: string;
  type: CategoryType;
  icon: string;
  color: string;
  is_preset: boolean;
  is_essential: boolean;
  /** Заполнено, если это служебная категория конкретной цели накопления. */
  linked_goal_id: string | null;
}

export interface PlanAllocation {
  id: string;
  category_id: string;
  planned_amount: string;
  category?: Category;
}

export interface MonthlyPlan {
  id: string;
  month: string;
  currency: string;
  total_income: string;
  allocations: PlanAllocation[];
}

export interface RecommendationCategoryItem {
  category_id: string;
  category_name: string;
  suggested_amount: string;
  bucket: "essential" | "lifestyle" | "savings";
  based_on: "history" | "rule_50_30_20" | "ai";
}

export interface RecommendationResponse {
  essential_total: string;
  lifestyle_total: string;
  savings_total: string;
  items: RecommendationCategoryItem[];
  explanation: string;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  color: string;
  currency: string;
  target_amount: string;
  current_amount: string;
  deadline: string | null;
  status: GoalStatus;
  progress_percent: number;
  /** Служебная категория трат этой цели — пополнение = Transaction с этим category_id. */
  category_id: string | null;
}

/**
 * Пополнение цели — это обычная Transaction в её служебной категории (см.
 * Goal.category_id). Этот тип собирается на клиенте из уже загруженного
 * списка транзакций (см. pages/TrackerPage.tsx), отдельного API нет.
 */
export interface GoalContributionWithGoal {
  id: string;
  amount: string;
  contributed_on: string;
  note: string | null;
  goal_id: string;
  goal_name: string;
  goal_icon: string;
  goal_color: string;
}

export interface Transaction {
  id: string;
  category_id: string;
  type: CategoryType;
  amount: string;
  currency: string;
  description: string | null;
  occurred_on: string;
  category?: Category;
}

export interface CategorySummaryItem {
  category_id: string;
  category_name: string;
  category_color: string;
  category_icon: string;
  planned_amount: string;
  actual_amount: string;
  remaining_amount: string;
  percent_used: number;
}

export interface PeriodSummary {
  period_start: string;
  period_end: string;
  currency: string;
  total_planned: string;
  total_actual: string;
  total_income: string;
  total_income_actual: string;
  categories: CategorySummaryItem[];
}

export interface Quote {
  id: string;
  text: string;
  author: string | null;
  category: string;
}
