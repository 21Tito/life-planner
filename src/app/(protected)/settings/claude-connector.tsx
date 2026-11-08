"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export interface Connection {
  id: string;
  clientName: string | null;
  createdAt: string;
  lastUsedAt: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function ClaudeConnector({ connectorUrl, connections }: { connectorUrl: string; connections: Connection[] }) {
  const supabase = createClient();
  const [list, setList] = useState(connections);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function copyUrl() {
    await navigator.clipboard.writeText(connectorUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function disconnect(id: string) {
    setRemoving(id);
    setError(null);
    // .select() confirms a row was actually deleted; RLS silently matches nothing otherwise
    const { data, error } = await supabase.from("oauth_grants").delete().eq("id", id).select("id");
    setRemoving(null);
    if (error || !data?.length) setError(`Couldn't disconnect${error ? `: ${error.message}` : "."}`);
    else setList((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <Card className="mt-6">
      <CardContent className="py-5 px-5">
        <h2 className="text-base font-semibold mb-1">Claude connector</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Let Claude see your kitchen and recipes, suggest meals, and save recipes or plan meals when you ask. In
          claude.ai, go to Settings → Connectors → Add custom connector and paste this URL.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-mono break-all mb-3">
          {connectorUrl}
        </div>
        <Button onClick={copyUrl} variant="outline" className="rounded-full h-9 px-4 text-sm">
          {copied ? "Copied!" : "Copy URL"}
        </Button>

        <h3 className="text-sm font-semibold mt-6 mb-2">Connected apps</h3>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing connected yet.</p>
        ) : (
          <ul className="space-y-3">
            {list.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.clientName || "Claude"}</p>
                  <p className="text-xs text-muted-foreground">
                    Connected {formatDate(c.createdAt)}
                    {c.lastUsedAt && ` · Last used ${formatDate(c.lastUsedAt)}`}
                  </p>
                </div>
                <Button
                  onClick={() => disconnect(c.id)}
                  disabled={removing === c.id}
                  variant="ghost"
                  className="text-xs text-muted-foreground hover:text-destructive h-8 px-3 flex-shrink-0"
                >
                  {removing === c.id ? "Disconnecting…" : "Disconnect"}
                </Button>
              </li>
            ))}
          </ul>
        )}
        {error && <p className="text-sm text-destructive mt-3">{error}</p>}
      </CardContent>
    </Card>
  );
}
