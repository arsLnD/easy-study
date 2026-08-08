/**
 * Единый axios-клиент для всех обращений к backend API.
 *
 * Как работает авторизация на фронтенде:
 * 1. access_token и refresh_token сохраняются в localStorage (через
 *    useAuthStore, см. src/store/authStore.ts) после логина/регистрации.
 * 2. Interceptor запроса добавляет "Authorization: Bearer <access_token>"
 *    к каждому исходящему запросу.
 * 3. Если backend отвечает 401 (токен истёк), interceptor ответа один раз
 *    пытается обновить токены через /api/auth/refresh и повторяет исходный
 *    запрос. Если обновление тоже не удалось — разлогиниваем пользователя.
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { useAuthStore } from "@/store/authStore";

// В разработке используется относительный путь /api (проксируется Vite'ом
// на backend, см. vite.config.ts). В продакшне можно указать полный адрес
// backend через переменную окружения VITE_API_BASE_URL (см. .env.example).
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  headers: { "Content-Type": "application/json" },
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = useAuthStore.getState().refreshToken;
  if (!refreshToken) return null;

  try {
    const response = await axios.post(`${apiClient.defaults.baseURL}/auth/refresh`, {
      refresh_token: refreshToken,
    });
    const { access_token, refresh_token } = response.data;
    useAuthStore.getState().setTokens(access_token, refresh_token);
    return access_token as string;
  } catch {
    useAuthStore.getState().logout();
    return null;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      refreshPromise = refreshPromise ?? refreshAccessToken();
      const newToken = await refreshPromise;
      refreshPromise = null;

      if (newToken) {
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      }
    }

    return Promise.reject(error);
  }
);
