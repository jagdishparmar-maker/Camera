"use client";

import { ReactNode } from "react";

type DockItem = {
  id: string;
  label: string;
  icon: ReactNode;
  active?: boolean;
};

type DockLayoutProps = {
  dockItems: DockItem[];
  onDockItemClick?: (id: string) => void;
  children: ReactNode;
};

export function DockLayout({
  dockItems,
  onDockItemClick,
  children,
}: DockLayoutProps) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--ym-bg)]">
      <aside className="flex w-11 flex-shrink-0 flex-col items-center gap-0.5 border-r-2 border-[var(--ym-border)] bg-[var(--ym-bg-panel)] py-2">
        {dockItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onDockItemClick?.(item.id)}
            className={`flex h-8 w-8 items-center justify-center border-l-2 transition-colors ${
              item.active
                ? "border-[var(--ym-accent)] bg-[var(--ym-accent)]/10 text-[var(--ym-accent)]"
                : "border-transparent text-[var(--ym-text-muted)] hover:bg-[var(--ym-border)]/30 hover:text-[var(--ym-text)]"
            }`}
            title={item.label}
          >
            {item.icon}
          </button>
        ))}
      </aside>
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  );
}
