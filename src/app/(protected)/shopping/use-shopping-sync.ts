"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOwnerId } from "@/lib/household-context";
import { ShoppingSync } from "@/lib/shopping-sync";
import type { ShoppingItem } from "@/types";

const RETRY_MS = 20_000;

function deviceStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** The shopping list's offline-tolerant sync (see ShoppingSync), retried while changes wait. */
export function useShoppingSync(
  setItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>,
  onError: (message: string) => void
) {
  const ownerId = useOwnerId();
  const [status, setStatus] = useState({ waiting: 0, offline: false });
  const [sync] = useState(
    () => new ShoppingSync(createClient(), ownerId, { setItems, onError, onStatus: setStatus }, typeof window === "undefined" ? null : deviceStorage())
  );

  useEffect(() => {
    sync.restore();
    const retry = () => {
      if (sync.waiting > 0) void sync.flush();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(retry, RETRY_MS);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [sync]);

  return {
    add: sync.add.bind(sync),
    update: sync.update.bind(sync),
    remove: sync.remove.bind(sync),
    /** Sends everything now; true when nothing is left waiting */
    sync: sync.flush.bind(sync),
    /** Changes saved on this device that haven't reached the server yet */
    waiting: status.waiting,
    /** The last attempt couldn't reach the server */
    offline: status.offline,
  };
}
