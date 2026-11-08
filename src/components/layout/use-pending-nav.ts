"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/** Highlights a nav item the moment it's tapped instead of after the next page has loaded. */
export function usePendingNav() {
  const pathname = usePathname();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => setPending(null), [pathname]);

  return {
    isActive: (href: string) => (pending ? pending === href : pathname.startsWith(href)),
    onNavigate: (href: string) => {
      if (!pathname.startsWith(href)) setPending(href);
    },
  };
}
