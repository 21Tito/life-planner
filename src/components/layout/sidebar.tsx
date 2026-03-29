"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Icons } from "@/components/ui/icons";

interface SidebarProps {
  user: {
    email: string;
    name: string;
    avatar?: string;
  };
}

const navItems = [
  { href: "/dashboard", label: "Dashboard",   icon: Icons.dashboard },
  { href: "/meals",     label: "Meal Planner", icon: Icons.clipboard },
  { href: "/trips",     label: "Trip Planner", icon: Icons.map },
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
    <>
      {/* Mobile top header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-[var(--color-border)] px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-[var(--color-brand-600)] flex items-center justify-center text-white text-xs font-bold">
            LP
          </div>
          <span className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>
            Life Planner
          </span>
        </div>
        {user.avatar ? (
          <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <div className="h-8 w-8 rounded-full bg-[var(--color-brand-200)] flex items-center justify-center text-sm font-bold text-[var(--color-brand-700)]">
            {user.name.charAt(0).toUpperCase()}
          </div>
        )}
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-[var(--color-border)] bg-white px-4 py-6">
        <div className="mb-8 px-2 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-brand-600)] flex items-center justify-center text-white text-sm font-bold">
            LP
          </div>
          <h2
            className="text-lg font-bold text-[var(--color-text)]"
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
                <span className={isActive ? "text-[var(--color-brand-400)]" : "text-[var(--color-text-muted)]"}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--color-border)] pt-4">
          <div className="flex items-center gap-3 px-2 mb-3">
            {user.avatar ? (
              <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-[var(--color-brand-200)] flex items-center justify-center text-sm font-bold text-[var(--color-brand-700)]">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-xs text-[var(--color-text-muted)] truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-alt)] rounded-lg transition-colors"
          >
            <span>{Icons.signOut}</span>
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
