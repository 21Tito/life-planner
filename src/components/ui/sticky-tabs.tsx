"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

export interface StickyTab<T extends string> {
  value: T;
  label: string;
  badge?: number;
}

/**
 * Page section tabs pinned under the mobile app header (top of the page on desktop).
 * Publishes its height as --page-tabs-h on the parent element so other sticky elements
 * on the page can sit just below it.
 */
export function StickyTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: StickyTab<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}) {
  const anchorRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bar = barRef.current;
    const parent = bar?.parentElement;
    if (!bar || !parent) return;
    const observer = new ResizeObserver(() => {
      parent.style.setProperty("--page-tabs-h", `${bar.offsetHeight}px`);
    });
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

  function select(next: T) {
    // When the tabs are pinned, show the new tab from its top rather than mid-page
    const anchor = anchorRef.current;
    const bar = barRef.current;
    if (anchor && bar) {
      const pinnedAt = parseFloat(getComputedStyle(bar).top) || 0;
      const anchorTop = anchor.getBoundingClientRect().top;
      if (anchorTop < pinnedAt) window.scrollTo({ top: window.scrollY + anchorTop - pinnedAt });
    }
    onChange(next);
  }

  return (
    <>
      {/* -mt-6 cancels the page's top gap on mobile so the bar sits flush under the app header */}
      <div ref={anchorRef} className="-mt-6 lg:mt-0" />
      <div
        ref={barRef}
        className="sticky top-[calc(3.5rem_+_env(safe-area-inset-top))] lg:top-0 z-30 -mx-4 px-4 lg:mx-0 lg:px-0 py-2 mb-4 lg:mb-6 bg-background/85 backdrop-blur-xl border-b border-border lg:border-0"
      >
        <div
          role="tablist"
          aria-label={label}
          className="grid gap-1 rounded-xl bg-muted p-1 text-[13px] sm:text-sm lg:inline-flex"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={value === tab.value}
              onClick={() => select(tab.value)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg px-1.5 py-1.5 lg:px-4 font-medium whitespace-nowrap transition-all touch-manipulation",
                value === tab.value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="min-w-5 h-5 px-1 rounded-full bg-[var(--color-brand-600)] text-white text-[11px] leading-5 tabular-nums">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
