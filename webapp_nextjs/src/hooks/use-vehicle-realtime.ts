import { useCallback, useEffect, useRef, useState } from "react";
import { isPocketBaseAbortError } from "@/lib/pocketbase-errors";
import type { Vehicle } from "@/lib/vehicle-types";
import { subscribeVehicles } from "@/lib/realtime";

export type RealtimeConnectionStatus = "connecting" | "live" | "reconnecting" | "offline";

type RealtimeAction = "create" | "update" | "delete";

export function useVehicleRealtime(
  onRecord: (action: RealtimeAction, record: Vehicle) => void,
): { status: RealtimeConnectionStatus; retry: () => void } {
  const [status, setStatus] = useState<RealtimeConnectionStatus>("connecting");
  const [attempt, setAttempt] = useState(0);
  const handlerRef = useRef(onRecord);
  handlerRef.current = onRecord;
  const offlineSinceRetryRef = useRef(false);

  const retry = useCallback(() => {
    setStatus((s) => (s === "offline" ? "reconnecting" : "connecting"));
    setAttempt((a) => a + 1);
  }, []);

  useEffect(() => {
    const goOnline = () => {
      if (!offlineSinceRetryRef.current) return;
      offlineSinceRetryRef.current = false;
      setStatus("reconnecting");
      setAttempt((a) => a + 1);
    };
    const goOffline = () => {
      offlineSinceRetryRef.current = true;
      setStatus("offline");
    };
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | null = null;

    setStatus((prev) => (prev === "live" ? "reconnecting" : "connecting"));

    subscribeVehicles<Vehicle>((action, record) => {
      handlerRef.current(action as RealtimeAction, record);
    })
      .then((fn) => {
        if (cancelled) {
          fn();
          return;
        }
        unsub = fn;
        setStatus("live");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (isPocketBaseAbortError(err)) return;
        setStatus("offline");
      });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [attempt]);

  return { status, retry };
}
