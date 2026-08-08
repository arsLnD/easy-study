import type { ReactNode } from "react";
import { BottomNav } from "@/components/layout/BottomNav";

/**
 * Общая "рамка" приложения для всех авторизованных экранов: ограничивает
 * контент по ширине как на телефоне (max-w-md) даже на большом экране
 * браузера — иначе интерфейс будет неестественно растянут на десктопе,
 * а PWA задумано mobile-first.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-md bg-background pb-24">
      {children}
      <BottomNav />
    </div>
  );
}
