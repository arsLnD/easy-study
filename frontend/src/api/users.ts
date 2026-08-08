import { apiClient } from "@/api/client";
import type { User, UserSettings } from "@/types";

export async function updateProfile(fullName: string): Promise<User> {
  const { data } = await apiClient.patch<User>("/users/me", { full_name: fullName });
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post("/users/me/change-password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

export async function getSettings(): Promise<UserSettings> {
  const { data } = await apiClient.get<UserSettings>("/users/me/settings");
  return data;
}

export async function updateSettings(payload: Partial<UserSettings>): Promise<UserSettings> {
  const { data } = await apiClient.patch<UserSettings>("/users/me/settings", payload);
  return data;
}
