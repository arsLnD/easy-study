import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
}

export function Input({ label, hint, className = "", id, ...rest }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-textSecondary">
          {label}
        </label>
      )}
      <input
        id={id}
        className={`rounded-xl border border-border bg-surfaceMuted px-4 py-3 text-textPrimary
          placeholder:text-textSecondary/60 outline-none transition-colors
          focus:border-primary focus:ring-1 focus:ring-primary ${className}`}
        {...rest}
      />
      {hint && <span className="text-xs text-textSecondary">{hint}</span>}
    </div>
  );
}
