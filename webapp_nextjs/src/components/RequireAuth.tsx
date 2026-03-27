"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isReady } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isReady, router]);

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <p className="text-sm text-[var(--text-muted)]">Redirecting to sign in…</p>
      </div>
    );
  }

  return <>{children}</>;
}
