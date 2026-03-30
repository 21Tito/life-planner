"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/ui/icons";

interface UserMenuProps {
  user: {
    id: string;
    email: string;
    name: string;
    avatar?: string;
  };
  size?: "sm" | "default" | "lg";
  dropdownPosition?: "bottom-right" | "top-left";
}

export function UserMenu({ user, size = "default", dropdownPosition = "bottom-right" }: UserMenuProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(user.name);
  const [avatarPreview, setAvatarPreview] = useState(user.avatar);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Sync with refreshed server data
  useEffect(() => {
    setName(user.name);
    setAvatarPreview(user.avatar);
  }, [user.name, user.avatar]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function handleSave() {
    setSaving(true);
    try {
      await supabase.from("profiles").update({ full_name: name }).eq("id", user.id);
      router.refresh();
      setEditOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Immediate local preview
    setAvatarPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${user.id}/avatar.${ext}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
        await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
        setAvatarPreview(publicUrl);
        router.refresh();
      }
    } finally {
      setUploading(false);
    }
  }

  const dropdownClass =
    dropdownPosition === "top-left"
      ? "left-0 bottom-full mb-2"
      : "right-0 top-full mt-2";

  return (
    <>
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="Open user menu"
          aria-expanded={dropdownOpen}
        >
          <Avatar size={size}>
            <AvatarImage src={avatarPreview} alt={name} />
            <AvatarFallback className="bg-secondary text-primary font-bold">
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </button>

        {dropdownOpen && (
          <div className={`absolute ${dropdownClass} w-44 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden py-1`}>
            <button
              onClick={() => { setEditOpen(true); setDropdownOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            >
              <span className="text-muted-foreground">{Icons.people}</span>
              Edit profile
            </button>
            <button
              onClick={() => { router.push("/settings"); setDropdownOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors text-left"
            >
              <span className="text-muted-foreground">{Icons.settings}</span>
              Settings
            </button>
            <div className="h-px bg-border mx-2 my-1" />
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-muted transition-colors text-left text-destructive"
            >
              <span>{Icons.signOut}</span>
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setEditOpen(false)}
          />
          <div className="relative bg-card rounded-2xl border border-border shadow-xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold">Edit Profile</h2>
              <Button variant="ghost" size="icon-sm" onClick={() => setEditOpen(false)}>
                {Icons.close}
              </Button>
            </div>

            {/* Avatar */}
            <div className="flex flex-col items-center mb-6">
              <button
                onClick={() => fileRef.current?.click()}
                className="relative group"
                aria-label="Change photo"
                disabled={uploading}
              >
                <Avatar className="size-20">
                  <AvatarImage src={avatarPreview} alt={name} />
                  <AvatarFallback className="bg-secondary text-primary font-bold text-2xl">
                    {name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploading ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" className="animate-spin">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                  ) : (
                    <span className="text-white">{Icons.plus}</span>
                  )}
                </div>
              </button>
              <p className="text-xs text-muted-foreground mt-2">Click to change photo</p>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </div>

            {/* Name */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1.5">Display Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-10 text-sm"
                placeholder="Your name"
              />
            </div>

            {/* Email (read-only) */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Email</label>
              <Input
                value={user.email}
                readOnly
                className="h-10 text-sm bg-muted text-muted-foreground cursor-default"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || uploading}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
