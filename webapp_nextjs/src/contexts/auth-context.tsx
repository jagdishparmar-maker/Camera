"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  startTransition,
  type ReactNode,
} from "react";
import type { RecordModel } from "pocketbase";
import { pb } from "@/lib/pocketbase";

/** PocketBase auth collection slug (default built-in users). */
export const AUTH_COLLECTION = "users";

type AuthContextValue = {
  user: RecordModel | null;
  isAuthenticated: boolean;
  /** True after client mount so localStorage-backed auth is read (avoids SSR/hydration mismatch). */
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<RecordModel | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    startTransition(() => {
      setUser(pb.authStore.model);
      setIsReady(true);
    });
    const unsub = pb.authStore.onChange((_token, model) => {
      setUser(model);
    });
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    await pb.collection(AUTH_COLLECTION).authWithPassword(email.trim(), password);
  }, []);

  const logout = useCallback(() => {
    pb.authStore.clear();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: pb.authStore.isValid,
      isReady,
      login,
      logout,
    }),
    [user, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
