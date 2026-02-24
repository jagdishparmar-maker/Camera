import { useEffect, useRef } from "react";
import { subscribe, type RealtimeHandler } from "@/lib/realtime";

/**
 * Hook to subscribe to realtime updates for a collection
 *
 * @param collection - Collection name
 * @param callback - Handler for create/update/delete events (wrap in useCallback to avoid resubscribing)
 * @param recordId - Optional: subscribe to a specific record only
 */
export function useRealtime<T = Record<string, unknown>>(
  collection: string,
  callback: RealtimeHandler<T>,
  recordId?: string
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => Promise<void>) | null = null;
    subscribe<T>(
      collection,
      (action, record) => callbackRef.current(action, record),
      recordId
    ).then((unsub) => {
      unsubscribe = unsub;
      if (cancelled) unsub();
    });
    return () => {
      cancelled = true;
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [collection, recordId]);
}
