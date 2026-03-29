"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AcceptInviteClient({
  token,
  ownerName,
}: {
  token: string;
  ownerName: string;
}) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setAccepting(true);
    setError(null);
    try {
      const res = await fetch("/api/household/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } finally {
      setAccepting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-bold mx-auto mb-6">
          LP
        </div>
        <h1 className="text-2xl font-bold mb-2">You&apos;re invited!</h1>
        <p className="text-muted-foreground text-sm mb-8">
          <span className="font-semibold text-foreground">{ownerName}</span>{" "}
          has invited you to collaborate on their Life Planner — trips, meals,
          and more.
        </p>

        {error && (
          <p className="text-sm text-destructive mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2">
            {error}
          </p>
        )}

        <Button
          onClick={accept}
          disabled={accepting}
          className="w-full rounded-full h-11 text-sm font-medium"
        >
          {accepting ? "Joining…" : `Join ${ownerName}'s household`}
        </Button>

        <p className="text-xs text-muted-foreground mt-4">
          You&apos;ll be able to view and edit shared trips and meal plans.
        </p>
      </div>
    </div>
  );
}
