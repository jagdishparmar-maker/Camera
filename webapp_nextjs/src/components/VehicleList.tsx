"use client";

import type { Vehicle, VehicleStatus } from "@/lib/vehicle-types";
import {
  computeStatus,
  formatTimeAgo,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/vehicle-types";

function getFileUrl(vehicle: Vehicle, filename: string): string {
  const base = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090";
  const collId = vehicle.collectionId ?? "vehicles";
  return `${base}/api/files/${collId}/${vehicle.id}/${filename}`;
}

type VehicleListProps = {
  inwardVehicles: Vehicle[];
  outwardVehicles: Vehicle[];
  loading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
  onVehicleClick?: (vehicle: Vehicle) => void;
};

function VehicleRow({ vehicle, onClick }: { vehicle: Vehicle; onClick?: () => void }) {
  const status =
    vehicle.status ??
    computeStatus({
      Check_Out_Date: vehicle.Check_Out_Date,
      Dock_Out_DateTime: vehicle.Dock_Out_DateTime,
      Assigned_Dock: vehicle.Assigned_Dock,
      Dock_In_DateTime: vehicle.Dock_In_DateTime,
    });
  const statusColor = STATUS_COLORS[status as VehicleStatus] ?? "#64748B";
  const statusLabel = STATUS_LABELS[status as VehicleStatus] ?? status;

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      className={`grid min-w-[520px] grid-cols-[40px_minmax(70px,1fr)_minmax(70px,1fr)_minmax(50px,1fr)_40px_56px_48px] gap-1 items-center border-b border-[var(--ym-border)] px-2 py-1.5 text-[11px] transition-colors hover:bg-[var(--ym-accent)]/5 ${onClick ? "cursor-pointer" : ""}`}
    >
      <div className="relative h-7 w-10 flex-shrink-0 overflow-hidden border border-[var(--ym-border)]">
        {vehicle.image ? (
          <img src={getFileUrl(vehicle, vehicle.image)} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-[var(--ym-text-muted)]">
            #
          </div>
        )}
        <span
          className="absolute bottom-0 left-0 right-0 py-0.5 text-center text-[8px] font-bold text-white"
          style={{ backgroundColor: statusColor }}
        >
          {statusLabel.replace(" ", "")}
        </span>
      </div>
      <div className="min-w-0 truncate font-bold text-[var(--ym-text)]">{vehicle.vehicleno}</div>
      <div className="min-w-0 truncate text-[var(--ym-text-muted)]" title={vehicle.Customer}>
        {vehicle.Customer || "--"}
      </div>
      <div className="min-w-0 truncate text-[var(--ym-text-muted)]" title={vehicle.Driver_Name}>
        {vehicle.Driver_Name || "--"}
      </div>
      <div className="text-center">
        {vehicle.Assigned_Dock != null ? (
          <span className="inline-flex h-5 min-w-[20px] items-center justify-center border border-[var(--ym-border)] bg-[var(--ym-bg-panel)] px-1 text-[10px] font-bold">
            {vehicle.Assigned_Dock}
          </span>
        ) : (
          <span className="text-[var(--ym-text-muted)]">--</span>
        )}
      </div>
      <div className="truncate text-[var(--ym-text-muted)]" title={vehicle.Transport}>
        {vehicle.Transport || "--"}
      </div>
      <div className="tabular-nums text-[var(--ym-text-muted)]">
        {vehicle.Check_In_Date ? formatTimeAgo(vehicle.Check_In_Date) : "--"}
      </div>
    </div>
  );
}

function VehicleSection({
  title,
  count,
  vehicles,
  emptyMessage,
  onVehicleClick,
}: {
  title: string;
  count: number;
  vehicles: Vehicle[];
  emptyMessage: string;
  onVehicleClick?: (vehicle: Vehicle) => void;
}) {
  return (
    <section className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b-2 border-[var(--ym-border)] bg-[var(--ym-bg-panel)] px-2 py-1.5">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-[var(--ym-text-muted)]">
          {title}
        </h2>
        <span className="border border-[var(--ym-border)] bg-[var(--ym-bg)] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-[var(--ym-text)]">
          {count}
        </span>
      </div>
      <div className="flex-1 overflow-auto overflow-x-auto">
        {vehicles.length === 0 ? (
          <div className="flex h-14 items-center justify-center border-b border-dashed border-[var(--ym-border)] px-4 text-[11px] text-[var(--ym-text-muted)]">
            {emptyMessage}
          </div>
        ) : (
          <>
            <div className="grid min-w-[520px] grid-cols-[40px_minmax(70px,1fr)_minmax(70px,1fr)_minmax(50px,1fr)_40px_56px_48px] gap-1 border-b-2 border-[var(--ym-border)] bg-[var(--ym-bg-panel)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[var(--ym-text-muted)]">
              <span></span>
              <span>VEHICLE</span>
              <span>CUSTOMER</span>
              <span>DRIVER</span>
              <span className="text-center">DOCK</span>
              <span>TRANSPORT</span>
              <span>CHECK-IN</span>
            </div>
            {vehicles.map((vehicle) => (
              <VehicleRow
                key={vehicle.id}
                vehicle={vehicle}
                onClick={onVehicleClick ? () => onVehicleClick(vehicle) : undefined}
              />
            ))}
          </>
        )}
      </div>
    </section>
  );
}

export function VehicleList({
  inwardVehicles,
  outwardVehicles,
  loading,
  error,
  onRefresh,
  onVehicleClick,
}: VehicleListProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-6 text-[var(--ym-text-muted)]">
        <p className="text-center text-[11px] text-[var(--ym-error)]">ERROR: {error}</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="border border-[var(--ym-border)] bg-[var(--ym-bg)] px-3 py-1.5 text-[11px] hover:bg-[var(--ym-border)]/30"
          >
            RETRY
          </button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <span className="animate-pulse text-[var(--ym-text-muted)]">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
      <VehicleSection
        title="INWARD"
        count={inwardVehicles.length}
        vehicles={inwardVehicles}
        emptyMessage="No inward vehicles on site"
        onVehicleClick={onVehicleClick}
      />
      <div className="hidden w-px flex-shrink-0 bg-[var(--ym-border)] lg:block" />
      <VehicleSection
        title="OUTWARD"
        count={outwardVehicles.length}
        vehicles={outwardVehicles}
        emptyMessage="No outward vehicles on site"
        onVehicleClick={onVehicleClick}
      />
    </div>
  );
}
