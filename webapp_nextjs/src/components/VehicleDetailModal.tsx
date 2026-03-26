"use client";

import type { Vehicle, VehicleStatus } from "@/lib/vehicle-types";
import {
  computeStatus,
  formatDateTime,
  getDockDuration,
  getYardDuration,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/vehicle-types";

function getFileUrl(vehicle: Vehicle, filename: string): string {
  const base = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090";
  const collId = vehicle.collectionId ?? "vehicles";
  return `${base}/api/files/${collId}/${vehicle.id}/${filename}`;
}

function DetailRow({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
      <span className="flex-shrink-0 text-xs font-medium text-[var(--text-muted)] w-24">{label}</span>
      <span className="text-right text-sm font-mono text-[var(--text)] break-all">
        {value != null && value !== "" ? String(value) : <span className="text-[var(--text-xmuted)]">—</span>}
      </span>
    </div>
  );
}

type VehicleDetailModalProps = {
  vehicle: Vehicle | null;
  onClose: () => void;
};

export function VehicleDetailModal({ vehicle, onClose }: VehicleDetailModalProps) {
  if (!vehicle) return null;

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
  const imageUrl = vehicle.image ? getFileUrl(vehicle, vehicle.image) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left: Photo ── */}
        <div className="relative flex w-2/5 flex-shrink-0 flex-col overflow-hidden bg-[var(--bg-muted)]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={vehicle.vehicleno}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-[var(--text-xmuted)]">
              <span className="text-6xl">🚛</span>
              <span className="text-xs font-medium">No photo available</span>
            </div>
          )}

          {/* Overlay badge at bottom of photo */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-8">
            <p className="font-mono text-lg font-bold text-white drop-shadow">{vehicle.vehicleno}</p>
            <span
              className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: statusColor }}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {/* ── Right: Details ── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Detail header */}
          <div className="flex flex-shrink-0 items-center justify-between border-b border-[var(--border)] bg-[var(--bg-subtle)] px-4 py-3">
            <div>
              <p className="font-mono text-base font-bold text-[var(--text)]">{vehicle.vehicleno}</p>
              <p className="text-xs text-[var(--text-muted)]">{vehicle.Type ?? "—"}</p>
            </div>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)] transition-colors"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Scrollable detail rows */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            <DetailRow label="Type" value={vehicle.Type} />
            <DetailRow label="Customer" value={vehicle.Customer} />
            <DetailRow label="Transport" value={vehicle.Transport} />
            <DetailRow label="Driver" value={vehicle.Driver_Name} />
            <DetailRow label="Contact" value={vehicle.Contact_No} />
            <DetailRow label="Check In" value={vehicle.Check_In_Date ? formatDateTime(vehicle.Check_In_Date) : null} />
            <DetailRow label="Check Out" value={vehicle.Check_Out_Date ? formatDateTime(vehicle.Check_Out_Date) : null} />
            <DetailRow
              label="Yard Duration"
              value={getYardDuration(vehicle)}
            />
            <DetailRow label="Assigned Dock" value={vehicle.Assigned_Dock != null ? `Dock ${vehicle.Assigned_Dock}` : null} />
            <DetailRow label="Dock In" value={vehicle.Dock_In_DateTime ? formatDateTime(vehicle.Dock_In_DateTime) : null} />
            <DetailRow label="Dock Out" value={vehicle.Dock_Out_DateTime ? formatDateTime(vehicle.Dock_Out_DateTime) : null} />
            <DetailRow
              label="Dock Duration"
              value={getDockDuration(vehicle)}
            />
            <DetailRow label="Remarks" value={vehicle.Remarks} />
          </div>
        </div>
      </div>
    </div>
  );
}
