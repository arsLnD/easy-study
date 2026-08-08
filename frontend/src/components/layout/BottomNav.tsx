import { NavLink } from "react-router-dom";
import { CalendarRange, Settings, WalletCards } from "lucide-react";

/**
 * Нижняя навигация — mobile-first паттерн (как в большинстве финансовых
 * приложений на телефоне). Три пункта:
 *  - "Мой план"  и "Трекер"  — два главных экрана приложения (п.1 требований).
 *  - "Настройки" — хаб, откуда доступны все остальные экраны: профиль,
 *    категории, управление целями, периодичность внесения трат.
 */
const items = [
  { to: "/plan", label: "Мой план", icon: CalendarRange },
  { to: "/tracker", label: "Трекер", icon: WalletCards },
  { to: "/settings", label: "Настройки", icon: Settings },
];

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
                isActive ? "text-primary" : "text-textSecondary"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
