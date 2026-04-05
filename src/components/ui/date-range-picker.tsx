"use client";

import { useState, useRef, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import type { DateRange } from "react-day-picker";
import "react-day-picker/style.css";

interface Props {
  value: { from: Date | undefined; to: Date | undefined };
  onChange: (range: { from: Date | undefined; to: Date | undefined }) => void;
  placeholder?: string;
}

function formatRange(from: Date | undefined, to: Date | undefined): string {
  if (!from) return "";
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  if (!to || from.getTime() === to.getTime()) return fmt(from);
  return `${fmt(from)} – ${fmt(to)}`;
}

function nightCount(from: Date | undefined, to: Date | undefined): string {
  if (!from || !to) return "";
  const nights = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  if (nights <= 0) return "";
  return `${nights} night${nights !== 1 ? "s" : ""}`;
}

export function DateRangePicker({ value, onChange, placeholder = "Select dates" }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const displayText = formatRange(value.from, value.to);
  const nights = nightCount(value.from, value.to);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full h-10 px-3 rounded-lg border text-sm text-left flex items-center justify-between gap-2 transition-colors ${
          open
            ? "border-[var(--color-brand-600)] ring-2 ring-[var(--color-brand-600)]/20"
            : "border-input hover:border-[var(--color-brand-600)]/50"
        } bg-background`}
      >
        <span className={displayText ? "text-foreground" : "text-muted-foreground"}>
          {displayText || placeholder}
        </span>
        <span className="flex items-center gap-1.5 shrink-0">
          {nights && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
              {nights}
            </span>
          )}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
          </svg>
        </span>
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-white rounded-xl shadow-xl border border-border p-3 w-fit">
          <DayPicker
            mode="range"
            selected={value as DateRange}
            onSelect={(range) => {
              onChange({ from: range?.from, to: range?.to });
              // Auto-close only when a real range (two distinct dates) is complete
              if (
                range?.from &&
                range?.to &&
                range.from.getTime() !== range.to.getTime()
              ) {
                setOpen(false);
              }
            }}
            disabled={{ before: new Date() }}
            showOutsideDays
            classNames={{
              root: "rdp-custom",
              months: "flex gap-4",
              month_caption: "flex justify-center items-center h-8 mb-1",
              caption_label: "text-sm font-semibold",
              nav: "flex items-center gap-1",
              button_previous: "absolute left-1 top-1 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground",
              button_next: "absolute right-1 top-1 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground",
              month_grid: "w-full border-collapse",
              weekdays: "flex",
              weekday: "w-9 h-9 flex items-center justify-center text-[11px] font-medium text-muted-foreground",
              weeks: "flex flex-col gap-0.5",
              week: "flex",
              day: "w-9 h-9 flex items-center justify-center",
              day_button: "w-9 h-9 rounded-lg text-sm transition-colors hover:bg-muted font-normal focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-600)]/50",
              selected: "[&>button]:bg-[var(--color-brand-600)] [&>button]:text-white [&>button]:hover:bg-[var(--color-brand-600)]/90 [&>button]:font-medium",
              range_start: "[&>button]:rounded-r-none bg-[var(--color-brand-600)]/10 rounded-l-lg",
              range_end: "[&>button]:rounded-l-none bg-[var(--color-brand-600)]/10 rounded-r-lg",
              range_middle: "bg-[var(--color-brand-600)]/10 rounded-none [&>button]:bg-transparent [&>button]:hover:bg-[var(--color-brand-600)]/20 [&>button]:text-foreground [&>button]:rounded-none",
              outside: "opacity-40",
              disabled: "opacity-25 pointer-events-none",
              today: "[&>button]:font-bold [&>button]:text-[var(--color-brand-600)]",
              hidden: "invisible",
            }}
          />
          {value.from && (
            <div className="border-t border-border pt-2 mt-1 flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                {displayText || "Select end date"}
              </span>
              <button
                onClick={() => { onChange({ from: undefined, to: undefined }); }}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
