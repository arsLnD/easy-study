import { apiClient } from "@/api/client";
import type { Category, CategoryType } from "@/types";

export async function listCategories(type?: CategoryType): Promise<Category[]> {
  const { data } = await apiClient.get<Category[]>("/categories", { params: type ? { type } : {} });
  return data;
}

export async function createCategory(payload: {
  name: string;
  type: CategoryType;
  icon?: string;
  color?: string;
  is_essential?: boolean;
}): Promise<Category> {
  const { data } = await apiClient.post<Category>("/categories", payload);
  return data;
}

export async function updateCategory(id: string, payload: Partial<Category>): Promise<Category> {
  const { data } = await apiClient.patch<Category>(`/categories/${id}`, payload);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/categories/${id}`);
}
