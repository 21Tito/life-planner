"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { UserMenu } from "@/components/layout/user-menu";

interface SidebarProps {
  user: {
    id: string;
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

  return (
    <>
      {/* Mobile top header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white border-b border-border px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
            LP
          </div>
          <span className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>
            Life Planner
          </span>
        </div>
        <UserMenu user={user} size="sm" dropdownPosition="bottom-right" />
      </header>

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card px-4 py-6">
        <div className="mb-8 px-2 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
            LP
          </div>
          <h2
            className="text-lg font-bold text-foreground"
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
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className={isActive ? "text-primary/70" : "text-muted-foreground"}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border pt-4">
          <div className="flex items-center gap-3 px-2">
            <UserMenu user={user} size="default" dropdownPosition="top-left" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
