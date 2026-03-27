import { POCKETBASE_URL } from "@/lib/config";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { AppState, AppStateStatus } from "react-native";

export type ConnectivityStatus = "ok" | "no-internet" | "db-unreachable";

type ConnectivityContextValue = {
  status: ConnectivityStatus;
  isOnline: boolean;
  isDbReachable: boolean;
  retry: () => void;
};

const ConnectivityContext = createContext<ConnectivityContextValue | null>(null);

const DB_CHECK_INTERVAL_MS = 15000;
const DB_CHECK_TIMEOUT_MS = 8000;

async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DB_CHECK_TIMEOUT_MS);
    const url = `${POCKETBASE_URL.replace(/\/$/, "")}/api/health`;
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

export function ConnectivityProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isDbReachable, setIsDbReachable] = useState(true);

  const checkDb = useCallback(async () => {
    const ok = await checkDatabaseHealth();
    setIsDbReachable(ok);
  }, []);

  const retry = useCallback(async () => {
    const state = await NetInfo.fetch();
    setIsOnline(state.isConnected ?? false);
    if (state.isConnected) {
      await checkDb();
    }
  }, [checkDb]);

  useEffect(() => {
    const handleNetInfo = (state: NetInfoState) => {
      setIsOnline(state.isConnected ?? false);
    };

    const unsubscribe = NetInfo.addEventListener(handleNetInfo);
    NetInfo.fetch().then(handleNetInfo);

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isOnline) {
      setIsDbReachable(false);
      return;
    }

    let cancelled = false;
    const run = async () => {
      const ok = await checkDatabaseHealth();
      if (!cancelled) setIsDbReachable(ok);
    };
    run();

    const interval = setInterval(run, DB_CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [isOnline]);

  useEffect(() => {
    const handleAppState = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        checkDb();
      }
    };
    const sub = AppState.addEventListener("change", handleAppState);
    return () => sub.remove();
  }, [checkDb]);

  const status: ConnectivityStatus =
    !isOnline ? "no-internet" : !isDbReachable ? "db-unreachable" : "ok";

  const value: ConnectivityContextValue = {
    status,
    isOnline,
    isDbReachable,
    retry,
  };

  return (
    <ConnectivityContext.Provider value={value}>
      {children}
    </ConnectivityContext.Provider>
  );
}

export function useConnectivity() {
  const ctx = useContext(ConnectivityContext);
  if (!ctx) throw new Error("useConnectivity must be used within ConnectivityProvider");
  return ctx;
}
