export type VehicleStatus =
  | "CheckedIn"
  | "CheckedOut"
  | "DockedIn"
  | "DockedOut";

export const STATUS_COLORS: Record<VehicleStatus, string> = {
  CheckedIn: "#22C55E",
  CheckedOut: "#64748B",
  DockedIn: "#3B82F6",
  DockedOut: "#F59E0B",
};

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  CheckedIn: "Checked In",
  CheckedOut: "Checked Out",
  DockedIn: "Docked In",
  DockedOut: "Docked Out",
};

export function computeStatus(data: {
  Check_Out_Date?: string;
  Dock_Out_DateTime?: string;
  Assigned_Dock?: number;
  Dock_In_DateTime?: string;
}): VehicleStatus {
  if (data.Check_Out_Date) return "CheckedOut";
  if (data.Dock_Out_DateTime) return "DockedOut";
  if (data.Assigned_Dock != null || data.Dock_In_DateTime) return "DockedIn";
  return "CheckedIn";
}

export type Vehicle = {
  id: string;
  collectionId?: string;
  created?: string;
  vehicleno: string;
  image?: string;
  status?: VehicleStatus;
  Check_In_Date?: string;
  Type?: string;
  Transport?: string;
  Customer?: string;
  Driver_Name?: string;
  Contact_No?: string;
  Check_Out_Date?: string;
  Assigned_Dock?: number;
  Dock_In_DateTime?: string;
  Dock_Out_DateTime?: string;
  Remarks?: string;
  Checked_In_By?: string;
  Checked_Out_By?: string;
  expand?: {
    Checked_In_By?: { name?: string; email?: string };
    Checked_Out_By?: { name?: string; email?: string };
  };
};

/** Vehicle is on site if not checked out (no Check_Out_Date) */
export function isOnSite(vehicle: { Check_Out_Date?: string }): boolean {
  return !vehicle.Check_Out_Date;
}

/** Normalize PocketBase date string (space before time) to ISO format for reliable parsing */
function normalizeDateString(s: string): string {
  if (typeof s !== "string") return s;
  return s.replace(" ", "T");
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(normalizeDateString(iso));
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

/** Format duration in ms as "2h 15m", "45m", etc. */
export function formatDuration(ms: number): string {
  if (ms < 0) return "—";
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const parts: string[] = [];
  if (day > 0) parts.push(`${day}d`);
  if (hr % 24 > 0) parts.push(`${hr % 24}h`);
  if (min % 60 > 0 || parts.length === 0) parts.push(`${min % 60}m`);
  return parts.join(" ");
}

/** Compute duration between two ISO strings */
export function computeDuration(from: string | undefined, to: string | undefined): string | null {
  if (!from || !to) return null;
  const a = new Date(normalizeDateString(from)).getTime();
  const b = new Date(normalizeDateString(to)).getTime();
  if (isNaN(a) || isNaN(b)) return null;
  return formatDuration(b - a);
}

/** Get date value from record - accepts string, Date, or number (ms). Tries multiple key names. */
function getDateField(rec: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = rec[k];
    if (v == null) continue;
    if (typeof v === "string" && v.trim()) return v;
    if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString();
    if (typeof v === "number" && !isNaN(v)) return new Date(v).toISOString();
  }
  return undefined;
}

/** Compute dock duration: Dock_In to Dock_Out, or Dock_In to now if still at dock.
 *  Fallback: when Assigned_Dock is set but Dock_In_DateTime is missing, use Check_In_Date as dock start. */
export function getDockDuration(vehicle: Record<string, unknown>): string | null {
  let from = getDateField(vehicle, "Dock_In_DateTime", "dock_in_date_time");
  if (!from && vehicle.Assigned_Dock != null) {
    from = getDateField(vehicle, "Check_In_Date", "check_in_date");
  }
  if (!from) return null;
  const to = getDateField(vehicle, "Dock_Out_DateTime", "dock_out_date_time") ?? new Date().toISOString();
  return computeDuration(from, to);
}

/** Compute yard duration: Check_In to Check_Out, or Check_In to now if still on site */
export function getYardDuration(vehicle: Record<string, unknown>): string | null {
  const from = getDateField(vehicle, "Check_In_Date", "check_in_date");
  if (!from) return null;
  const to = getDateField(vehicle, "Check_Out_Date", "check_out_date") ?? new Date().toISOString();
  return computeDuration(from, to);
}

/** Compact relative time (e.g. "2h ago", "5m ago") */
export function formatTimeAgo(iso: string): string {
  try {
    const d = new Date(normalizeDateString(iso));
    const now = new Date();
    const sec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (sec < 60) return "now";
    if (sec < 3600) return `${Math.floor(sec / 60)}m`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h`;
    if (sec < 604800) return `${Math.floor(sec / 86400)}d`;
    return d.toLocaleDateString();
  } catch {
    return iso;
  }
}
