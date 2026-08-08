import { apiClient } from "@/api/client";
import type { User } from "@/types";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export async function register(email: string, password: string, fullName: string): Promise<TokenPair> {
  const { data } = await apiClient.post<TokenPair>("/auth/register", {
    email,
    password,
    full_name: fullName,
  });
  return data;
}

export async function login(email: string, password: string): Promise<TokenPair> {
  const { data } = await apiClient.post<TokenPair>("/auth/login", { email, password });
  return data;
}

export async function fetchMe(): Promise<User> {
  const { data } = await apiClient.get<User>("/auth/me");
  return data;
}
