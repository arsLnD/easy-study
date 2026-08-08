import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function Card({ children, className = "", ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl2 border border-border bg-surface p-5 shadow-card ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
