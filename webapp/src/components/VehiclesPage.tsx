"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { pb } from "@/lib/pocketbase";
import type { Vehicle, VehicleStatus } from "@/lib/vehicle-types";
import { computeStatus, getDockDuration, STATUS_COLORS, STATUS_LABELS } from "@/lib/vehicle-types";
import { subscribeVehicles } from "@/lib/realtime";
import { AnalyticsStats } from "./AnalyticsStats";
import { VehicleDetailModal } from "./VehicleDetailModal";

const COLLECTION = "vehicles";
type SortOption = "newest" | "oldest" | "vehicle" | "customer";

function formatCompact(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function RefreshIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

export function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "inward" | "outward" | "history">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [showStats, setShowStats] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await pb.collection(COLLECTION).getFullList<Vehicle>({
        sort: "-created",
        expand: "Checked_In_By,Checked_Out_By",
      });
      setVehicles(Array.isArray(list) ? list : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load vehicles");
      setVehicles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadVehicles(); }, [loadVehicles]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    subscribeVehicles<Vehicle>((action, record) => {
      setVehicles((prev) => {
        const r = record as Vehicle;
        if (action === "create") return [r, ...prev];
        if (action === "update") return prev.map((v) => (v.id === r.id ? r : v));
        if (action === "delete") return prev.filter((v) => v.id !== r.id);
        return prev;
      });
    }).then((fn) => { unsub = fn; setRealtimeConnected(true); });
    return () => { unsub?.(); setRealtimeConnected(false); };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === "r" && !e.ctrlKey && !e.metaKey) loadVehicles();
      if (e.key === "1") setFilter("all");
      if (e.key === "2") setFilter("inward");
      if (e.key === "3") setFilter("outward");
      if (e.key === "4") setFilter("history");
      if (e.key === "Escape") setSelectedVehicle(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [loadVehicles]);

  const onSiteVehicles = vehicles.filter((v) => !v.Check_Out_Date);
  const isHistoryView = filter === "history";
  const sourceVehicles = isHistoryView ? vehicles : onSiteVehicles;

  const sortFn = useMemo(() => {
    const fns: Record<SortOption, (a: Vehicle, b: Vehicle) => number> = {
      newest: (a, b) => new Date(b.Check_In_Date ?? b.created ?? 0).getTime() - new Date(a.Check_In_Date ?? a.created ?? 0).getTime(),
      oldest: (a, b) => new Date(a.Check_In_Date ?? a.created ?? 0).getTime() - new Date(b.Check_In_Date ?? b.created ?? 0).getTime(),
      vehicle: (a, b) => (a.vehicleno ?? "").localeCompare(b.vehicleno ?? ""),
      customer: (a, b) => (a.Customer ?? "").localeCompare(b.Customer ?? ""),
    };
    return fns[sortBy];
  }, [sortBy]);

  const filteredVehicles = sourceVehicles
    .filter((v) => {
      const ok = !searchQuery.trim() ||
        [v.vehicleno, v.Customer, v.Driver_Name, v.Transport, v.Type]
          .filter(Boolean)
          .some((val) => String(val).toLowerCase().includes(searchQuery.toLowerCase()));
      if (!ok) return false;
      if (filter === "inward") return v.Type === "Inward";
      if (filter === "outward") return v.Type === "Outward";
      if (filter === "history") return true; // both columns get their type filter below
      return true;
    })
    .sort(sortFn);

  const inwardVehicles = filteredVehicles.filter((v) => v.Type === "Inward");
  const outwardVehicles = filteredVehicles.filter((v) => v.Type === "Outward");
  const inwardCount = sourceVehicles.filter((v) => v.Type === "Inward").length;
  const outwardCount = sourceVehicles.filter((v) => v.Type === "Outward").length;

  const docks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const vehiclesByDock = docks.reduce<Record<number, Vehicle[]>>((acc, dock) => {
    acc[dock] = onSiteVehicles.filter((v) => v.Assigned_Dock === dock);
    return acc;
  }, {});

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-[var(--bg)]">

      {/* ── Top bar ── */}
      <header className="flex flex-shrink-0 flex-col border-b border-[var(--border)] bg-[var(--bg-subtle)]">
        <div className="flex items-center gap-3 px-4 py-2">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <span className="text-xl">🏭</span>
            <span className="text-sm font-bold text-[var(--text)]">GateMS</span>
            <span className="hidden text-xs text-[var(--text-muted)] sm:block">Gate Management</span>
          </div>

          {/* Live badge */}
          {realtimeConnected && (
            <span className="flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
              LIVE
            </span>
          )}

          {/* Search */}
          <div className="relative">
            <svg className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[var(--text-xmuted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="search"
              placeholder="Search vehicles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-44 rounded-md border border-[var(--border)] bg-[var(--bg)] pl-6 pr-2 text-xs text-[var(--text)] placeholder-[var(--text-xmuted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
            />
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-7 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 text-xs text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="vehicle">Vehicle No</option>
            <option value="customer">Customer</option>
          </select>

          {/* Filter tabs */}
          <div className="flex rounded-md border border-[var(--border)] bg-[var(--bg)] p-0.5">
            {[
              { id: "all" as const, label: "All", count: onSiteVehicles.length },
              { id: "inward" as const, label: "Inward", count: inwardCount },
              { id: "outward" as const, label: "Outward", count: outwardCount },
              { id: "history" as const, label: "History", count: vehicles.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`h-6 rounded px-2.5 text-xs font-medium transition-colors ${
                  filter === tab.id
                    ? "bg-[var(--accent)] text-white shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {tab.label}
                <span className={`ml-1 font-mono ${filter === tab.id ? "text-blue-100" : "text-[var(--text-xmuted)]"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setShowStats((s) => !s)}
              className={`h-7 rounded-md border px-2.5 text-xs font-medium transition-colors ${
                showStats
                  ? "border-[var(--accent-border)] bg-[var(--accent-bg)] text-[var(--accent)]"
                  : "border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              Stats
            </button>
            <button
              onClick={loadVehicles}
              disabled={loading}
              className="flex h-7 items-center gap-1.5 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2.5 text-xs font-medium text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] disabled:opacity-40"
            >
              <RefreshIcon />
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>
        </div>

        {showStats && (
          <div className="border-t border-[var(--border)] px-4 py-1.5">
            <AnalyticsStats vehicles={onSiteVehicles} />
          </div>
        )}
      </header>

      {/* ── Three-column body ── */}
      <div className="grid min-h-0 flex-1 grid-cols-3">

        {/* Col 1 – Inward */}
        <VehicleColumn
          title="Inward"
          count={inwardVehicles.length}
          vehicles={inwardVehicles}
          loading={loading}
          error={error}
          onRefresh={loadVehicles}
          onVehicleClick={setSelectedVehicle}
          emptyMessage={isHistoryView ? "No inward vehicles" : "No inward vehicles on site"}
          colorScheme="inward"
          includeCheckedOut={isHistoryView}
        />

        {/* Divider */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-x border-[var(--border)]">

          {/* Col 2 – Outward */}
          <VehicleColumn
            title="Outward"
            count={outwardVehicles.length}
            vehicles={outwardVehicles}
            loading={loading}
            error={error}
            onRefresh={loadVehicles}
            onVehicleClick={setSelectedVehicle}
            emptyMessage={isHistoryView ? "No outward vehicles" : "No outward vehicles on site"}
            colorScheme="outward"
            includeCheckedOut={isHistoryView}
          />
        </div>

        {/* Col 3 – Dock Status */}
        <DockColumn
          docks={docks}
          vehiclesByDock={vehiclesByDock}
          loading={loading}
          error={error}
          onRefresh={loadVehicles}
          onVehicleClick={setSelectedVehicle}
        />
      </div>

      <VehicleDetailModal vehicle={selectedVehicle} onClose={() => setSelectedVehicle(null)} />
    </div>
  );
}

// ── Vehicle column ──

const STATUS_GROUP_ORDER_ON_SITE: VehicleStatus[] = ["CheckedIn", "DockedIn", "DockedOut"];
const STATUS_GROUP_ORDER_ALL: VehicleStatus[] = ["CheckedIn", "DockedIn", "DockedOut", "CheckedOut"];

const STATUS_GROUP_META: Record<VehicleStatus, { label: string; dot: string; bg: string; text: string }> = {
  CheckedIn:  { label: "Checked In",  dot: "#22C55E", bg: "#f0fdf4", text: "#15803d" },
  DockedIn:   { label: "Docked In",   dot: "#3B82F6", bg: "#eff6ff", text: "#1d4ed8" },
  DockedOut:  { label: "Docked Out",  dot: "#F59E0B", bg: "#fffbeb", text: "#b45309" },
  CheckedOut: { label: "Checked Out", dot: "#64748B", bg: "#f8fafc", text: "#64748b" },
};

function VehicleColumn({
  title,
  count,
  vehicles,
  loading,
  error,
  onRefresh,
  onVehicleClick,
  emptyMessage,
  colorScheme,
  includeCheckedOut = false,
}: {
  title: string;
  count: number;
  vehicles: Vehicle[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onVehicleClick?: (v: Vehicle) => void;
  emptyMessage: string;
  colorScheme: "inward" | "outward";
  includeCheckedOut?: boolean;
}) {
  const accentColor = colorScheme === "inward" ? "var(--inward-accent)" : "var(--outward-accent)";
  const headerBg = colorScheme === "inward" ? "var(--inward-bg)" : "var(--outward-bg)";
  const headerBorder = colorScheme === "inward" ? "var(--inward-border)" : "var(--outward-border)";

  const grouped = useMemo(() => {
    const map: Partial<Record<VehicleStatus, Vehicle[]>> = {};
    for (const v of vehicles) {
      const s =
        v.status ??
        computeStatus({
          Check_Out_Date: v.Check_Out_Date,
          Dock_Out_DateTime: v.Dock_Out_DateTime,
          Assigned_Dock: v.Assigned_Dock,
          Dock_In_DateTime: v.Dock_In_DateTime,
        });
      if (!map[s]) map[s] = [];
      map[s]!.push(v);
    }
    return map;
  }, [vehicles]);

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      {/* Column header */}
      <div
        className="flex flex-shrink-0 items-center justify-between border-b px-3 py-2"
        style={{ backgroundColor: headerBg, borderColor: headerBorder }}
      >
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
          <h2 className="text-sm font-semibold" style={{ color: accentColor }}>
            {title}
          </h2>
        </div>
        <span className="rounded-full border px-2 py-0.5 font-mono text-xs font-bold tabular-nums" style={{ borderColor: headerBorder, color: accentColor }}>
          {count}
        </span>
      </div>

      {/* Column sub-header */}
      <div className="grid grid-cols-[1fr_1fr_88px] gap-0 border-b border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-xmuted)]">Vehicle / Transport</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-xmuted)]">Customer</span>
        <span className="text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--text-xmuted)]">Check-in</span>
      </div>

      {/* Rows */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState error={error} onRefresh={onRefresh} />
        ) : vehicles.length === 0 ? (
          <EmptyState message={emptyMessage} />
        ) : (
          <div className="pb-4">
            {(includeCheckedOut ? STATUS_GROUP_ORDER_ALL : STATUS_GROUP_ORDER_ON_SITE).map((status) => {
              const group = grouped[status];
              if (!group || group.length === 0) return null;
              const meta = STATUS_GROUP_META[status];
              return (
                <div key={status}>
                  {/* Group header */}
                  <div
                    className="sticky top-0 z-10 flex items-center gap-2 border-b border-t px-3 py-1"
                    style={{ backgroundColor: meta.bg, borderColor: meta.dot + "40" }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: meta.dot }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: meta.text }}>
                      {meta.label}
                    </span>
                    <span className="ml-auto font-mono text-[10px] font-bold tabular-nums" style={{ color: meta.text }}>
                      {group.length}
                    </span>
                  </div>
                  {/* Group rows */}
                  <div className="divide-y divide-[var(--border)]">
                    {group.map((v) => (
                      <VehicleRow
                        key={v.id}
                        vehicle={v}
                        onClick={onVehicleClick ? () => onVehicleClick(v) : undefined}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function isCheckedInOver24h(vehicle: Vehicle): boolean {
  const d = vehicle.Check_In_Date;
  if (!d) return false;
  const checkIn = new Date(d).getTime();
  const now = Date.now();
  return now - checkIn > 24 * 60 * 60 * 1000;
}

function VehicleRow({ vehicle, onClick }: { vehicle: Vehicle; onClick?: () => void }) {
  const status =
    vehicle.status ??
    computeStatus({
      Check_Out_Date: vehicle.Check_Out_Date,
      Dock_Out_DateTime: vehicle.Dock_Out_DateTime,
      Assigned_Dock: vehicle.Assigned_Dock,
      Dock_In_DateTime: vehicle.Dock_In_DateTime,
    });
  const statusColor = STATUS_COLORS[status as VehicleStatus] ?? "#64748b";
  const statusLabel = STATUS_LABELS[status as VehicleStatus] ?? status;
  const over24h = !vehicle.Check_Out_Date && isCheckedInOver24h(vehicle);

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onClick(); } }}
      className={`group grid grid-cols-[1fr_1fr_88px] gap-0 items-center px-3 py-2 transition-colors ${onClick ? "cursor-pointer" : ""} ${
        over24h ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-[var(--bg-subtle)]"
      }`}
    >
      {/* Vehicle / Transport */}
      <div className="min-w-0 pr-2">
        <div className="flex items-center gap-1.5">
          <span
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: statusColor }}
            title={statusLabel}
          />
          <span className="font-mono text-sm font-semibold text-[var(--text)] truncate">
            {vehicle.vehicleno}
          </span>
          {vehicle.Assigned_Dock != null && (
            <span className="ml-1 flex-shrink-0 rounded bg-[var(--s-dockedin)]/10 px-1 py-0.5 font-mono text-[9px] font-bold text-[var(--s-dockedin)]">
              D{vehicle.Assigned_Dock}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-xs text-[var(--text-xmuted)]">
          {vehicle.Transport || "—"}
        </div>
      </div>

      {/* Customer – highlighted */}
      <div className="min-w-0 pr-2">
        {vehicle.Customer ? (
          <span className="block truncate text-xs font-semibold text-[var(--accent)]">
            {vehicle.Customer}
          </span>
        ) : (
          <span className="text-xs text-[var(--text-xmuted)]">—</span>
        )}
      </div>

      {/* Check-in */}
      <div className="text-right">
        {vehicle.Check_In_Date ? (
          <>
            <span className="block font-mono text-xs font-semibold tabular-nums text-[var(--text)]">
              {new Date(vehicle.Check_In_Date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            </span>
            <span className="block font-mono text-xs tabular-nums text-[var(--text-muted)]">
              {new Date(vehicle.Check_In_Date).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}
            </span>
          </>
        ) : (
          <span className="text-xs text-[var(--text-xmuted)]">—</span>
        )}
      </div>
    </div>
  );
}

// ── Dock column ──

function DockColumn({
  docks,
  vehiclesByDock,
  loading,
  error,
  onRefresh,
  onVehicleClick,
}: {
  docks: number[];
  vehiclesByDock: Record<number, Vehicle[]>;
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onVehicleClick?: (v: Vehicle) => void;
}) {
  const occupied = docks.filter((d) => vehiclesByDock[d]?.length > 0).length;

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[var(--dock-bg)]">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--text-muted)]" />
          <h2 className="text-base font-semibold text-[var(--text-muted)]">Dock Status</h2>
        </div>
        <span className="rounded-full border border-[var(--border)] px-2.5 py-1 font-mono text-sm font-bold tabular-nums text-[var(--text-muted)]">
          {occupied}/{docks.length}
        </span>
      </div>

      {/* Sub-header */}
      <div className="grid grid-cols-[44px_1fr_1fr_80px_44px] gap-0 border-b border-[var(--border)] bg-[var(--bg-muted)] px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-xmuted)]">Dock</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-xmuted)]">Vehicle</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-xmuted)]">Customer</span>
        <span className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-xmuted)]">Duration</span>
        <span className="text-center text-xs font-semibold uppercase tracking-wider text-[var(--text-xmuted)]">Type</span>
      </div>

      {/* Dock rows */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {loading ? (
          <LoadingRows />
        ) : error ? (
          <ErrorState error={error} onRefresh={onRefresh} />
        ) : (
          <div className="divide-y divide-[var(--border)] pb-4">
            {docks.map((dockNum) => {
              const dockVehicles = vehiclesByDock[dockNum] ?? [];
              const isEmpty = dockVehicles.length === 0;

              return (
                <div key={dockNum}>
                  {isEmpty ? (
                    <div className="grid grid-cols-[44px_1fr_1fr_80px_44px] items-center px-3 py-2.5">
                      <span className="font-mono text-sm font-bold text-[var(--text-xmuted)]">{dockNum}</span>
                      <span className="col-span-4 text-sm text-[var(--text-xmuted)]">—</span>
                    </div>
                  ) : (
                    dockVehicles.map((v, idx) => (
                      <div
                        key={v.id}
                        role="button"
                        onClick={() => onVehicleClick?.(v)}
                        className={`grid cursor-pointer grid-cols-[44px_1fr_1fr_80px_44px] items-center px-3 py-2.5 transition-colors ${idx > 0 ? "border-t border-dashed border-[var(--border)]" : ""} ${
                          isCheckedInOver24h(v) ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-[var(--bg-subtle)]"
                        }`}
                      >
                        <span className="font-mono text-sm font-bold text-[var(--text-muted)]">
                          {idx === 0 ? dockNum : ""}
                        </span>
                        <span className="min-w-0 truncate pr-1 font-mono text-sm font-semibold text-[var(--text)]">
                          {v.vehicleno}
                        </span>
                        <span className="min-w-0 truncate pr-1 text-sm text-[var(--text-muted)]">
                          {v.Customer || "—"}
                        </span>
                        <span className="min-w-0 text-center font-mono text-sm tabular-nums text-[var(--text)]" title={getDockDuration(v) ?? undefined}>
                          {getDockDuration(v) ?? "—"}
                        </span>
                        <div className="flex justify-center">
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                            v.Type === "Inward"
                              ? "bg-[var(--inward-bg)] text-[var(--inward-accent)] border border-[var(--inward-border)]"
                              : v.Type === "Outward"
                              ? "bg-[var(--outward-bg)] text-[var(--outward-accent)] border border-[var(--outward-border)]"
                              : "bg-[var(--bg-muted)] text-[var(--text-xmuted)]"
                          }`}>
                            {v.Type === "Inward" ? "IN" : v.Type === "Outward" ? "OUT" : v.Type ?? "—"}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Shared helpers ──

function LoadingRows() {
  return (
    <div className="space-y-px p-3">
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-center gap-2 rounded px-2 py-2.5 animate-pulse">
          <div className="h-1.5 w-1.5 rounded-full bg-[var(--border)]" />
          <div className="h-3 w-24 rounded bg-[var(--border)]" />
          <div className="h-3 w-16 rounded bg-[var(--border)] opacity-60" />
        </div>
      ))}
    </div>
  );
}

function ErrorState({ error, onRefresh }: { error: string; onRefresh?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 p-8">
      <p className="text-center text-sm text-[var(--error)]">{error}</p>
      {onRefresh && (
        <button
          onClick={onRefresh}
          className="rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-1.5 text-xs hover:bg-[var(--bg-subtle)]"
        >
          Retry
        </button>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-24 items-center justify-center">
      <p className="text-sm text-[var(--text-xmuted)]">{message}</p>
    </div>
  );
}
