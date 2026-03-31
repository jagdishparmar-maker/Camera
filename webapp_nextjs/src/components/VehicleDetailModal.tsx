"use client";

import { useEffect, useState } from "react";
import type { Vehicle, VehicleStatus } from "@/lib/vehicle-types";
import {
  auditCheckedInByLabel,
  auditCheckedOutByLabel,
  computeStatus,
  formatDateTime,
  getDockDuration,
  getYardDuration,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/vehicle-types";
import { VehicleImageLightbox } from "./VehicleImageLightbox";

function getFileUrl(vehicle: Vehicle, filename: string): string {
  const base = process.env.NEXT_PUBLIC_POCKETBASE_URL ?? "http://127.0.0.1:8090";
  const collId = vehicle.collectionId ?? "vehicles";
  return `${base}/api/files/${collId}/${vehicle.id}/${filename}`;
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-[var(--accent-bg)] text-[var(--accent)] [&>svg]:h-3 [&>svg]:w-3">
        {icon}
      </span>
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--text-muted)]">{children}</h3>
    </div>
  );
}

function DetailSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <SectionTitle icon={icon}>{title}</SectionTitle>
      <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)]/90 p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        {children}
      </div>
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string | number | null }) {
  const display = value != null && value !== "" ? String(value) : null;
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="text-[10px] font-medium leading-none text-[var(--text-muted)]">{label}</p>
      <p className="text-xs font-medium leading-tight text-[var(--text)] break-words">
        {display ?? <span className="font-normal text-[var(--text-xmuted)]">—</span>}
      </p>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value?: string | null }) {
  const display = value != null && value !== "" ? value : null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--border)] bg-[var(--bg)] px-2 py-1.5">
      <span className="text-[10px] font-medium text-[var(--text-muted)]">{label}</span>
      <span className="text-right text-xs font-semibold tabular-nums text-[var(--text)]">
        {display ?? <span className="font-normal text-[var(--text-xmuted)]">—</span>}
      </span>
    </div>
  );
}

function RemarksBlock({ value }: { value?: string | null }) {
  const display = value != null && value.trim() !== "" ? value.trim() : null;
  return (
    <div className="min-h-[2.25rem] rounded-md border border-dashed border-[var(--border-strong)] bg-[var(--bg)]/80 px-2 py-1.5">
      <p className="whitespace-pre-wrap text-xs leading-snug text-[var(--text)]">
        {display ?? <span className="text-[var(--text-xmuted)]">No remarks</span>}
      </p>
    </div>
  );
}

/* --- inline icons (no extra deps) --- */
function IconTruck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}
function IconDock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z" />
      <path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2" />
      <path d="M12 5v14" />
    </svg>
  );
}
function IconNote() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
      <path d="M10 9H8" />
    </svg>
  );
}

type VehicleDetailModalProps = {
  vehicle: Vehicle | null;
  onClose: () => void;
};

export function VehicleDetailModal({ vehicle, onClose }: VehicleDetailModalProps) {
  const [photoZoomOpen, setPhotoZoomOpen] = useState(false);

  useEffect(() => {
    setPhotoZoomOpen(false);
  }, [vehicle?.id]);

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

  const yardDur = getYardDuration(vehicle);
  const dockDur = getDockDuration(vehicle);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Left: Photo (unchanged behavior) ── */}
        <div className="relative flex w-2/5 flex-shrink-0 flex-col overflow-hidden bg-[var(--bg-muted)]">
          {imageUrl ? (
            <button
              type="button"
              onClick={() => setPhotoZoomOpen(true)}
              className="group relative h-full min-h-[200px] w-full cursor-zoom-in border-0 bg-transparent p-0 text-left"
              aria-label="View vehicle photo full screen with zoom"
            >
              <img
                src={imageUrl}
                alt={vehicle.vehicleno}
                className="h-full w-full object-cover"
              />
              <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/45 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                Zoom
              </span>
            </button>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-[var(--text-xmuted)]">
              <span className="text-6xl">🚛</span>
              <span className="text-xs font-medium">No photo available</span>
            </div>
          )}

          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-4 pb-4 pt-8">
            <p className="font-sans text-lg font-bold text-white drop-shadow">{vehicle.vehicleno}</p>
            <span
              className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
              style={{ backgroundColor: statusColor }}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {/* ── Right: Details (redesigned) ── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[var(--bg)]">
          <header className="flex shrink-0 items-start justify-between gap-2 border-b border-[var(--border)] bg-gradient-to-b from-[var(--bg-subtle)] to-[var(--bg)] px-3 py-2">
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="truncate text-base font-bold leading-tight tracking-tight text-[var(--text)]">{vehicle.vehicleno}</h2>
                <span
                  className="shrink-0 rounded-full px-2 py-px text-[10px] font-semibold text-white shadow-sm"
                  style={{ backgroundColor: statusColor }}
                >
                  {statusLabel}
                </span>
              </div>
              <p className="text-xs text-[var(--text-muted)]">{vehicle.Type ?? "Type not set"}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-[var(--text-muted)] transition-colors hover:border-[var(--border)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]"
              aria-label="Close"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div className="flex-1 space-y-2.5 overflow-y-auto px-3 py-2.5">
            <DetailSection icon={<IconTruck />} title="Vehicle & load">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Vehicle type" value={vehicle.Type} />
                <Field label="Transport" value={vehicle.Transport} />
              </div>
              <div className="mt-2 border-t border-[var(--border)] pt-2">
                <Field label="Customer" value={vehicle.Customer} />
              </div>
            </DetailSection>

            <DetailSection icon={<IconUser />} title="Driver & contact">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Driver" value={vehicle.Driver_Name} />
                <Field label="Contact" value={vehicle.Contact_No} />
              </div>
            </DetailSection>

            <DetailSection icon={<IconClock />} title="Yard & check-in / out">
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Check-in" value={vehicle.Check_In_Date ? formatDateTime(vehicle.Check_In_Date) : null} />
                <Field label="Check-out" value={vehicle.Check_Out_Date ? formatDateTime(vehicle.Check_Out_Date) : null} />
              </div>
              <div className="mt-2 grid gap-2 border-t border-[var(--border)] pt-2 sm:grid-cols-2">
                <Field label="Checked in by" value={auditCheckedInByLabel(vehicle)} />
                <Field label="Checked out by" value={auditCheckedOutByLabel(vehicle)} />
              </div>
              <div className="mt-2">
                <MetricRow label="Yard duration" value={yardDur} />
              </div>
            </DetailSection>

            <DetailSection icon={<IconDock />} title="Dock">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-medium text-[var(--text-muted)]">Assigned</span>
                {vehicle.Assigned_Dock != null ? (
                  <span className="inline-flex items-center rounded-md bg-[var(--dock-bg)] px-2 py-px text-xs font-semibold text-[var(--text)] ring-1 ring-[var(--border)]">
                    Dock {vehicle.Assigned_Dock}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--text-xmuted)]">—</span>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Dock in" value={vehicle.Dock_In_DateTime ? formatDateTime(vehicle.Dock_In_DateTime) : null} />
                <Field label="Dock out" value={vehicle.Dock_Out_DateTime ? formatDateTime(vehicle.Dock_Out_DateTime) : null} />
              </div>
              <div className="mt-2">
                <MetricRow label="Dock duration" value={dockDur} />
              </div>
            </DetailSection>

            <section className="space-y-1.5">
              <SectionTitle icon={<IconNote />}>Remarks</SectionTitle>
              <RemarksBlock value={vehicle.Remarks} />
            </section>
          </div>
        </div>
      </div>

      {imageUrl ? (
        <VehicleImageLightbox
          src={imageUrl}
          alt={vehicle.vehicleno}
          open={photoZoomOpen}
          onClose={() => setPhotoZoomOpen(false)}
        />
      ) : null}
    </div>
  );
}
