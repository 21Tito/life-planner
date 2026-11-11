"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

// Older than this when it appears, the page was opened from a saved copy (or sat in memory)
const STALE_AFTER_MS = 15 * 1000;
// Back in the app after this long: its data may have changed elsewhere
const RETURN_REFRESH_MS = 2 * 60 * 1000;

/**
 * Pages open instantly from a copy saved on the device (see public/sw.js); this then fetches
 * current data in the background and shows it in place, with a small "Updating" note.
 */
export function KeepFresh({ renderedAt }: { renderedAt: number }) {
  const router = useRouter();
  const [updating, startTransition] = useTransition();

  useEffect(() => {
    let stale = Date.now() - renderedAt > STALE_AFTER_MS;
    let hiddenAt = 0;
    const refresh = () => {
      if (!navigator.onLine) return;
      stale = false;
      startTransition(() => router.refresh());
    };
    if (stale) refresh();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > RETURN_REFRESH_MS) refresh();
    };
    // Opened offline from a saved copy: update once the connection is back
    const onOnline = () => stale && refresh();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
    // Once per page load; a refresh brings a new renderedAt that shouldn't trigger another
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!updating) return null;
  return (
    <div
      role="status"
      className="fixed left-1/2 -translate-x-1/2 z-40 top-[calc(4rem_+_env(safe-area-inset-top))] lg:top-4 flex items-center gap-2 rounded-full bg-card/95 backdrop-blur px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-md ring-1 ring-foreground/10"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-brand-600)] animate-pulse" />
      Updating…
    </div>
  );
}
