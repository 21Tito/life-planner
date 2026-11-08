"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { usePendingNav } from "./use-pending-nav";

const navItems = [
  { href: "/trips", label: "Trips", icon: Icons.map },
  { href: "/meals", label: "Meals", icon: Icons.utensils },
];

// Matches the pill's p-1.5 inset, used to size and place the sliding highlight
const INSET_REM = 0.375;

export function MobileNav() {
  const pathname = usePathname();
  const nav = usePendingNav();

  // Hide on trip detail pages — the back link is enough to navigate away
  if (/^\/trips\/.+/.test(pathname)) return null;

  const activeIndex = navItems.findIndex((item) => nav.isActive(item.href));
  const count = navItems.length;

  return (
    <nav
      aria-label="Main"
      className="lg:hidden fixed inset-x-0 bottom-0 z-50 flex justify-center pointer-events-none pb-[calc(env(safe-area-inset-bottom)_+_0.75rem)]"
    >
      <div
        className="pointer-events-auto relative grid p-1.5 rounded-full bg-white/75 backdrop-blur-xl backdrop-saturate-150 ring-1 ring-black/5 shadow-[0_10px_30px_-6px_rgba(0,0,0,0.25)]"
        style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))`, width: "min(17rem, calc(100vw - 2.5rem))" }}
      >
        {/* Highlight that slides to the active tab */}
        <span
          aria-hidden
          className={cn(
            "absolute rounded-full bg-[var(--color-brand-600)] shadow-md transition-[transform,opacity] duration-300 ease-out",
            activeIndex < 0 && "opacity-0"
          )}
          style={{
            top: `${INSET_REM}rem`,
            bottom: `${INSET_REM}rem`,
            left: `${INSET_REM}rem`,
            width: `calc(${100 / count}% - ${(INSET_REM * 2) / count}rem)`,
            transform: `translateX(${Math.max(activeIndex, 0) * 100}%)`,
          }}
        />
        {navItems.map((item, i) => {
          const isActive = i === activeIndex;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => nav.onNavigate(item.href)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative z-10 flex items-center justify-center gap-2 h-11 rounded-full text-sm font-medium",
                "transition-[color,transform] duration-200 active:scale-95 touch-manipulation select-none",
                isActive ? "text-white" : "text-[var(--color-text-muted)]"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
