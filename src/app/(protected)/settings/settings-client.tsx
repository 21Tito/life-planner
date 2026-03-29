"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Member {
  id: string;
  name: string;
  avatar: string | null;
  joinedAt: string;
}

interface Props {
  members: Member[];
  activeToken: string | null;
  isMember: boolean;
}

export function SettingsClient({ members, activeToken, isMember }: Props) {
  const router = useRouter();
  const [currentMembers, setCurrentMembers] = useState<Member[]>(members);
  const [token, setToken] = useState<string | null>(activeToken);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
  const inviteLink = token ? `${baseUrl}/invite/${token}` : null;

  async function generateLink() {
    setGenerating(true);
    try {
      const res = await fetch("/api/household/invite", { method: "POST" });
      const data = await res.json();
      if (data.token) setToken(data.token);
    } finally {
      setGenerating(false);
    }
  }

  async function copyLink() {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function removeMember(memberId: string) {
    setRemoving(memberId);
    try {
      await fetch(`/api/household/members?memberId=${memberId}`, {
        method: "DELETE",
      });
      setCurrentMembers((prev) => prev.filter((m) => m.id !== memberId));
      router.refresh();
    } finally {
      setRemoving(null);
    }
  }

  if (isMember) {
    return (
      <div className="max-w-xl">
        <h1
          className="text-2xl lg:text-3xl font-bold mb-1"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          Manage your account preferences.
        </p>
        <Card>
          <CardContent className="py-5 px-5">
            <p className="text-sm text-muted-foreground">
              You are a member of someone else&apos;s household. You can see and
              edit their shared trips and meals.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <h1
        className="text-2xl lg:text-3xl font-bold mb-1"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Settings
      </h1>
      <p className="text-sm text-muted-foreground mb-8">
        Invite people to collaborate on your trips and meal plans.
      </p>

      {/* Invite section */}
      <Card className="mb-6">
        <CardContent className="py-5 px-5">
          <h2 className="text-base font-semibold mb-1">Invite someone</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Share this link with anyone you&apos;d like to give access to your
            household. They&apos;ll need to create an account (or log in) to
            accept.
          </p>

          {inviteLink ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-mono break-all">
                {inviteLink}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={copyLink}
                  variant="outline"
                  className="rounded-full h-9 px-4 text-sm"
                >
                  {copied ? "Copied!" : "Copy link"}
                </Button>
                <Button
                  onClick={generateLink}
                  disabled={generating}
                  variant="outline"
                  className="rounded-full h-9 px-4 text-sm text-destructive hover:text-destructive"
                >
                  {generating ? "Regenerating…" : "Regenerate"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Regenerating the link invalidates the previous one.
              </p>
            </div>
          ) : (
            <Button
              onClick={generateLink}
              disabled={generating}
              className="rounded-full h-9 px-5 text-sm"
            >
              {generating ? "Generating…" : "Generate invite link"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Members list */}
      <Card>
        <CardContent className="py-5 px-5">
          <h2 className="text-base font-semibold mb-4">
            Members{" "}
            <span className="text-muted-foreground font-normal text-sm">
              ({currentMembers.length})
            </span>
          </h2>

          {currentMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No members yet. Share an invite link to get started.
            </p>
          ) : (
            <ul className="space-y-3">
              {currentMembers.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold text-primary/70 flex-shrink-0">
                      {member.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={member.avatar}
                          alt={member.name}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                      ) : (
                        member.name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Joined{" "}
                        {new Date(member.joinedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => removeMember(member.id)}
                    disabled={removing === member.id}
                    variant="ghost"
                    className="text-xs text-muted-foreground hover:text-destructive h-8 px-3 flex-shrink-0"
                  >
                    {removing === member.id ? "Removing…" : "Remove"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
