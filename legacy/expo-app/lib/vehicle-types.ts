export type VehicleStatus = "CheckedIn" | "CheckedOut" | "DockedIn" | "DockedOut";

export const STATUS_COLORS: Record<VehicleStatus, string> = {
  CheckedIn: "#22C55E",
  CheckedOut: "#64748B",
  DockedIn: "#3B82F6",
  DockedOut: "#F59E0B",
};

export const STATUS_TEXT_COLORS: Record<VehicleStatus, string> = {
  CheckedIn: "#0F172A",
  CheckedOut: "#FFFFFF",
  DockedIn: "#FFFFFF",
  DockedOut: "#0F172A",
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
  vehicleno: string;
  image: string;
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

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
