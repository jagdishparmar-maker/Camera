"use client";

import type { Vehicle } from "@/lib/vehicle-types";
import { computeStatus } from "@/lib/vehicle-types";

type AnalyticsStatsProps = {
  /** On-site vehicles only (no Check_Out_Date). All stats are computed from this list. */
  vehicles: Vehicle[];
};

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      {color && (
        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: color }} />
      )}
      <span className="text-xs text-[var(--text-muted)]">{label}</span>
      <span className="font-mono text-sm font-bold text-[var(--text)] tabular-nums">{value}</span>
    </div>
  );
}

export function AnalyticsStats({ vehicles }: AnalyticsStatsProps) {
  // Filter to on-site only (no Check_Out_Date) – ensures correct counts even if parent passes all vehicles
  const onSite = vehicles.filter((v) => !v.Check_Out_Date);
  const checkedInToday = onSite.filter((v) => {
    if (!v.Check_In_Date) return false;
    const d = new Date(v.Check_In_Date);
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  });
  const inward = onSite.filter((v) => v.Type === "Inward");
  const outward = onSite.filter((v) => v.Type === "Outward");
  const byStatus = onSite.reduce(
    (acc, v) => {
      const s =
        v.status ??
        computeStatus({
          Check_Out_Date: v.Check_Out_Date,
          Dock_Out_DateTime: v.Dock_Out_DateTime,
          Assigned_Dock: v.Assigned_Dock,
          Dock_In_DateTime: v.Dock_In_DateTime,
        });
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const divider = <span className="text-[var(--border-strong)]">|</span>;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-1.5">
      <Stat label="On Site" value={onSite.length} color="var(--accent)" />
      {divider}
      <Stat label="Today" value={checkedInToday.length} color="var(--s-checkedin)" />
      {divider}
      <Stat label="Inward" value={inward.length} color="var(--inward-accent)" />
      <Stat label="Outward" value={outward.length} color="var(--outward-accent)" />
      {divider}
      <Stat label="Docked" value={(byStatus.DockedIn ?? 0) + (byStatus.DockedOut ?? 0)} color="var(--s-dockedin)" />
      <Stat label="Waiting" value={byStatus.CheckedIn ?? 0} color="var(--s-dockedout)" />
    </div>
  );
}
