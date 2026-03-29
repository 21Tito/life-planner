"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icons } from "@/components/ui/icons";

const navItems = [
  { href: "/dashboard", label: "Home",  icon: Icons.dashboard },
  { href: "/meals",     label: "Meals", icon: Icons.clipboard },
  { href: "/trips",     label: "Trips", icon: Icons.map },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-[var(--color-border)] flex">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-3 text-xs font-medium transition-colors ${
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
