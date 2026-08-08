/**
 * Глобальный стор аутентификации (Zustand).
 *
 * Почему Zustand: минимум шаблонного кода по сравнению с Redux, при этом
 * даёт глобальное реактивное состояние + встроенный `persist` middleware,
 * который сам сохраняет/восстанавливает состояние в localStorage — это и
 * даёт "сессию, которая переживает перезагрузку страницы" без лишнего кода.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "@/types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: User | null;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      logout: () => set({ accessToken: null, refreshToken: null, user: null }),
      isAuthenticated: () => Boolean(get().accessToken),
    }),
    { name: "plans-finance-auth" }
  )
);
