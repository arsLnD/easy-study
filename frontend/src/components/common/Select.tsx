import type { ReactNode, SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  children: ReactNode;
}

export function Select({ label, className = "", id, children, ...rest }: SelectProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-textSecondary">
          {label}
        </label>
      )}
      <select
        id={id}
        className={`rounded-xl border border-border bg-surfaceMuted px-4 py-3 text-textPrimary
          outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary ${className}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}
