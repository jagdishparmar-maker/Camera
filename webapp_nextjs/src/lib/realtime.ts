import type { UnsubscribeFunc } from "pocketbase";
import { pb } from "./pocketbase";

export type RealtimeHandler<T = Record<string, unknown>> = (
  action: "create" | "update" | "delete",
  record: T
) => void;

export function subscribeVehicles<T = Record<string, unknown>>(
  callback: RealtimeHandler<T>
): Promise<UnsubscribeFunc> {
  return pb.collection("vehicles").subscribe<T>(
    "*",
    (e) => {
      callback(e.action as "create" | "update" | "delete", e.record);
    },
    {
      expand: "Checked_In_By,Checked_Out_By",
      // Avoid auto-cancellation when React Strict Mode mounts twice (dev) or overlapping subscribes.
      requestKey: null,
    }
  );
}
