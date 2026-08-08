import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  fullWidth?: boolean;
  children: ReactNode;
}

const variantClasses: Record<string, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover shadow-glow",
  secondary: "bg-surfaceMuted text-textPrimary hover:bg-border border border-border",
  ghost: "bg-transparent text-textSecondary hover:text-textPrimary hover:bg-surface",
  danger: "bg-expense/90 text-white hover:bg-expense",
};

export function Button({ variant = "primary", fullWidth, className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl2 px-5 py-3 text-sm font-semibold
        transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none
        ${variantClasses[variant]} ${fullWidth ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
