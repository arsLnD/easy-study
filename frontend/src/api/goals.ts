import { apiClient } from "@/api/client";
import type { Goal } from "@/types";

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

export async function updateGoal(
  id: string,
  payload: Partial<{
    name: string;
    icon: string;
    color: string;
    target_amount: string;
    deadline: string | null;
    status: string;
  }>
): Promise<Goal> {
  const { data } = await apiClient.patch<Goal>(`/goals/${id}`, payload);
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  await apiClient.delete(`/goals/${id}`);
}
