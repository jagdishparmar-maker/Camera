"use client";

import { useEffect } from "react";

/** Registers the app shell service worker in production only. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* ignore — e.g. HTTP without HTTPS */
    });
  }, []);
  return null;
}
