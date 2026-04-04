"use client";

import { useState, useEffect } from "react";
import { Bell, BellOff, Check } from "lucide-react";

export function NotificationPrompt() {
  const [permission, setPermission] = useState<
    "default" | "granted" | "denied" | "unsupported"
  >("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as "default" | "granted" | "denied");
  }, []);

  async function subscribe() {
    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as "default" | "granted" | "denied");

      if (result !== "granted") {
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisuallyIdentifiesUser: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
        ),
      } as PushSubscriptionOptionsInit);

      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
    } catch (err) {
      console.error("Failed to subscribe to push:", err);
    }
    setLoading(false);
  }

  if (permission === "unsupported") return null;

  if (permission === "granted") {
    return (
      <div className="flex items-center gap-2 text-sm text-emerald-400">
        <Check className="w-4 h-4" />
        <span>Notifications enabled</span>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="flex items-center gap-2 text-sm text-[var(--color-text-muted)]">
        <BellOff className="w-4 h-4" />
        <span>Notifications blocked — enable in browser settings</span>
      </div>
    );
  }

  return (
    <button
      onClick={subscribe}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors disabled:opacity-50"
    >
      <Bell className="w-4 h-4" />
      <span>{loading ? "Enabling..." : "Enable trip reminders"}</span>
    </button>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
