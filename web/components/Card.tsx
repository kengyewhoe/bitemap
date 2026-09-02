import type { HTMLAttributes, ReactNode } from "react";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

// design.md §3/§5: the "clean touchpoint" surface — white sheet-surface,
// 16px radius (`rounded-lg`), sheet-outline hairline border. Used for list
// rows, place preview cards, rating cards, anything off the map canvas.
export function Card({ children, className = "", ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={`rounded-lg border border-sheet-outline bg-sheet-surface p-4 shadow-[0_8px_24px_rgba(0,0,0,0.06)] ${className}`}
    >
      {children}
    </div>
  );
}
