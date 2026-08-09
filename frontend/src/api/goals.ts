import { apiClient } from "@/api/client";
import type { Goal, GoalContribution, GoalContributionWithGoal } from "@/types";

export async function listGoals(): Promise<Goal[]> {
  const { data } = await apiClient.get<Goal[]>("/goals");
  return data;
}

export async function createGoal(payload: {
  name: string;
  icon?: string;
  color?: string;
  currency: string;
  target_amount: string;
  deadline?: string | null;
}): Promise<Goal> {
  const { data } = await apiClient.post<Goal>("/goals", payload);
  return data;
}

export async function updateGoal(id: string, payload: Partial<Goal>): Promise<Goal> {
  const { data } = await apiClient.patch<Goal>(`/goals/${id}`, payload);
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  await apiClient.delete(`/goals/${id}`);
}

export async function addContribution(
  goalId: string,
  payload: { amount: string; contributed_on: string; note?: string }
): Promise<Goal> {
  const { data } = await apiClient.post<Goal>(`/goals/${goalId}/contributions`, payload);
  return data;
}

export async function listContributions(goalId: string): Promise<GoalContribution[]> {
  const { data } = await apiClient.get<GoalContribution[]>(`/goals/${goalId}/contributions`);
  return data;
}

export async function listAllContributions(
  dateFrom: string,
  dateTo: string
): Promise<GoalContributionWithGoal[]> {
  const { data } = await apiClient.get<GoalContributionWithGoal[]>("/goals/contributions", {
    params: { date_from: dateFrom, date_to: dateTo },
  });
  return data;
}
