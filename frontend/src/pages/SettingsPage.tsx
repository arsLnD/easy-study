import { LogOut, ChevronRight, Palette, Target, Tags, User as UserIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { TopBar } from "@/components/layout/TopBar";
import { Card } from "@/components/common/Card";
import { useAuthStore } from "@/store/authStore";

const items = [
  { to: "/settings/profile", label: "Профиль и безопасность", icon: UserIcon },
  { to: "/settings/categories", label: "Категории трат и доходов", icon: Tags },
  { to: "/settings/goals", label: "Мои цели", icon: Target },
  { to: "/settings/preferences", label: "Периодичность и внешний вид", icon: Palette },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  return (
    <AppShell>
      <TopBar title="Настройки" subtitle={user?.full_name} />
      <div className="flex flex-col gap-4 px-5">
        <Card className="p-0 overflow-hidden">
          {items.map(({ to, label, icon: Icon }, idx) => (
            <button
              key={to}
              onClick={() => navigate(to)}
              className={`flex w-full items-center gap-3 px-4 py-4 text-left hover:bg-surfaceMuted ${
                idx !== items.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <Icon size={20} className="text-primary" />
              <span className="flex-1 text-sm font-medium">{label}</span>
              <ChevronRight size={18} className="text-textSecondary" />
            </button>
          ))}
        </Card>

        <button
          onClick={() => {
            logout();
            navigate("/login");
          }}
          className="flex items-center justify-center gap-2 rounded-xl2 border border-expense/30 bg-expense/10
            px-4 py-3.5 text-sm font-semibold text-expense hover:bg-expense/20"
        >
          <LogOut size={18} />
          Выйти из аккаунта
        </button>
      </div>
    </AppShell>
  );
}
