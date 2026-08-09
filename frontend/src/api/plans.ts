import { apiClient } from "@/api/client";
import type { MonthlyPlan, RecommendationResponse } from "@/types";

export async function getPlanForMonth(monthIso: string): Promise<MonthlyPlan | null> {
  try {
    const { data } = await apiClient.get<MonthlyPlan>(`/plans/${monthIso}`);
    return data;
  } catch (error: any) {
    if (error?.response?.status === 404) return null;
    throw error;
  }
}

export async function upsertPlan(payload: {
  month: string;
  currency: string;
  total_income: string;
  allocations: { category_id: string; planned_amount: string }[];
}): Promise<MonthlyPlan> {
  const { data } = await apiClient.put<MonthlyPlan>("/plans", payload);
  return data;
}

export async function getRecommendation(totalIncome: string, monthIso?: string): Promise<RecommendationResponse> {
  const { data } = await apiClient.post<RecommendationResponse>("/plans/recommendation", {
    total_income: totalIncome,
    month: monthIso ?? null,
  });
  return data;
}
