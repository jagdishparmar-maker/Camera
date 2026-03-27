"use client";

import { ClientResponseError } from "pocketbase";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/auth-context";

export default function LoginPage() {
  const { login, isAuthenticated, isReady } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, isReady, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.replace("/");
    } catch (err) {
      if (err instanceof ClientResponseError) {
        setError(err.response?.message || err.message || "Sign in failed");
      } else {
        setError("Sign in failed");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <p className="text-sm text-[var(--text-muted)]">Loading…</p>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)]">
        <p className="text-sm text-[var(--text-muted)]">Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg-subtle)] px-4">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg)] p-8 shadow-sm">
        <div className="mb-6 text-center">
          <span className="text-2xl" aria-hidden>
            🏭
          </span>
          <h1 className="mt-2 text-lg font-bold text-[var(--text)]">GateMS</h1>
          <p className="text-xs text-[var(--text-muted)]">Sign in with your account</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-xmuted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
              placeholder="you@company.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-xs font-medium text-[var(--text-muted)]">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]/30"
            />
          </div>

          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-[var(--accent)] py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>

      <p className="mt-6 text-center text-[10px] text-[var(--text-xmuted)]">
        PocketBase auth · users collection
      </p>
    </div>
  );
}
