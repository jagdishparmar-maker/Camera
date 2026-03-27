/**
 * PocketBase Realtime subscriptions
 *
 * Subscribe to collection changes for live updates.
 * Remember to call unsubscribe() when component unmounts.
 */

import type { UnsubscribeFunc } from "pocketbase";
import { pb } from "./pocketbase";

export type RealtimeHandler<T = Record<string, unknown>> = (
  action: "create" | "update" | "delete",
  record: T
) => void;

/**
 * Subscribe to realtime updates for a collection
 *
 * @param collection - Collection name to subscribe to
 * @param callback - Called when records are created, updated, or deleted
 * @param recordId - Optional: subscribe to a specific record only
 * @returns Promise that resolves to unsubscribe function - call when component unmounts
 */
export function subscribe<T = Record<string, unknown>>(
  collection: string,
  callback: RealtimeHandler<T>,
  recordId?: string
): Promise<UnsubscribeFunc> {
  return pb.collection(collection).subscribe<T>(
    recordId ?? "*",
    (e) => {
      callback(e.action as "create" | "update" | "delete", e.record);
    },
    { expand: "" }
  );
}

/**
 * Subscribe to realtime updates for a specific record
 */
export function subscribeRecord<T = Record<string, unknown>>(
  collection: string,
  recordId: string,
  callback: RealtimeHandler<T>
): Promise<UnsubscribeFunc> {
  return subscribe<T>(collection, callback, recordId);
}
