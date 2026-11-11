"use client";

import { useEffect } from "react";

/** Installs public/sw.js so pages work offline. Production only: in dev it would cache stale builds. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
