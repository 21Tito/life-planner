"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { usePendingNav } from "./use-pending-nav";

const navItems = [
  { href: "/trips", label: "Trips", icon: Icons.map },
  { href: "/meals", label: "Meals", icon: Icons.utensils },
];

export function MobileNav() {
  const pathname = usePathname();
  const nav = usePendingNav();

  // Hide on trip detail pages — the back link is enough to navigate away
  if (/^\/trips\/.+/.test(pathname)) return null;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[var(--color-border)] flex">
      {navItems.map((item) => {
        const isActive = nav.isActive(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => nav.onNavigate(item.href)}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors touch-manipulation active:bg-muted/60 ${
              isActive
                ? "text-[var(--color-brand-600)]"
                : "text-[var(--color-text-muted)]"
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
  );
}
