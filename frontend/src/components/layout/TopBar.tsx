import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface TopBarProps {
  title: string;
  subtitle?: string;
  back?: boolean;
  action?: ReactNode;
}

export function TopBar({ title, subtitle, back, action }: TopBarProps) {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 bg-background/95 px-5 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)] backdrop-blur-md">
      <div className="flex items-center gap-3">
        {back && (
          <button
            onClick={() => navigate(-1)}
            className="rounded-full p-1.5 text-textSecondary hover:bg-surfaceMuted hover:text-textPrimary"
          >
            <ChevronLeft size={22} />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold leading-tight">{title}</h1>
          {subtitle && <p className="text-sm text-textSecondary">{subtitle}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}
