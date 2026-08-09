import { apiClient } from "@/api/client";
import type { PeriodSummary, Transaction } from "@/types";

export async function listTransactions(params?: {
  date_from?: string;
  date_to?: string;
  category_id?: string;
}): Promise<Transaction[]> {
  const { data } = await apiClient.get<Transaction[]>("/transactions", { params });
  return data;
}

export async function createTransaction(payload: {
  category_id: string;
  type: "expense" | "income";
  amount: string;
  currency: string;
  description?: string;
  occurred_on: string;
}): Promise<Transaction> {
  const { data } = await apiClient.post<Transaction>("/transactions", payload);
  return data;
}

export async function updateTransaction(
  id: string,
  payload: Partial<{
    category_id: string;
    amount: string;
    description: string | null;
    occurred_on: string;
  }>
): Promise<Transaction> {
  const { data } = await apiClient.patch<Transaction>(`/transactions/${id}`, payload);
  return data;
}

export async function deleteTransaction(id: string): Promise<void> {
  await apiClient.delete(`/transactions/${id}`);
}

export async function getPeriodSummary(periodStart: string, periodEnd: string): Promise<PeriodSummary> {
  const { data } = await apiClient.get<PeriodSummary>("/transactions/summary/period", {
    params: { period_start: periodStart, period_end: periodEnd },
  });
  return data;
}
