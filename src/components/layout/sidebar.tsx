"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface SidebarProps {
  user: {
    email: string;
    name: string;
    avatar?: string;
  };
}

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "◻" },
  { href: "/meals", label: "Meal Planner", icon: "🍽" },
  { href: "/trips", label: "Trip Planner", icon: "✈" },
];

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-[var(--color-border)] bg-white px-4 py-6">
      <div className="mb-8 px-2">
        <h2
          className="text-xl font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Life Planner
        </h2>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-text)]"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[var(--color-border)] pt-4">
        <div className="flex items-center gap-3 px-2 mb-3">
          {user.avatar ? (
            <img
              src={user.avatar}
              alt=""
              className="h-8 w-8 rounded-full"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-[var(--color-brand-200)] flex items-center justify-center text-sm font-semibold text-[var(--color-brand-700)]">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-[var(--color-text-muted)] truncate">
              {user.email}
            </p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-alt)] rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
