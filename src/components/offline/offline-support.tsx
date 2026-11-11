"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { refreshSavedPages } from "@/lib/offline";

// Saved in the background so they open offline even if you only reached them in-app
const MAIN_PAGES = ["/dashboard", "/meals", "/shopping", "/trips"];

/** Whether the device has a connection, following online/offline events. */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/** Keeps offline copies of pages fresh, and says when you're looking at a saved copy. */
export function OfflineSupport() {
  const pathname = usePathname();
  const online = useOnline();

  useEffect(() => {
    if (online) refreshSavedPages([window.location.pathname + window.location.search, ...MAIN_PAGES]);
  }, [pathname, online]);

  // Shopping shows its own note, since it keeps working offline
  if (online || pathname.startsWith("/shopping")) return null;
  return (
    <div
      role="status"
      className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900"
    >
      <span className="font-medium">You&apos;re offline.</span> This is the last saved version. Changes here need a
      connection, but your shopping list works offline.
    </div>
  );
}
