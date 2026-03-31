"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useOwnerId } from "@/lib/household-context";
import type { TripDay, TripActivity, ActivityCategory } from "@/types";

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  ActivityCategory,
  { bg: string; border: string; text: string; dot: string; label: string }
> = {
  flight: {
    bg: "bg-emerald-100",
    border: "border-emerald-300",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
    label: "Traveling",
  },
  hotel: {
    bg: "bg-orange-100",
    border: "border-orange-300",
    text: "text-orange-800",
    dot: "bg-orange-500",
    label: "Hotel",
  },
  restaurant: {
    bg: "bg-rose-100",
    border: "border-rose-300",
    text: "text-rose-800",
    dot: "bg-rose-400",
    label: "Food",
  },
  activity: {
    bg: "bg-blue-100",
    border: "border-blue-300",
    text: "text-blue-800",
    dot: "bg-blue-500",
    label: "Sightseeing",
  },
  transport: {
    bg: "bg-teal-100",
    border: "border-teal-300",
    text: "text-teal-800",
    dot: "bg-teal-500",
    label: "Transport",
  },
  shopping: {
    bg: "bg-amber-100",
    border: "border-amber-300",
    text: "text-amber-800",
    dot: "bg-amber-500",
    label: "Shopping",
  },
  rest: {
    bg: "bg-purple-100",
    border: "border-purple-300",
    text: "text-purple-800",
    dot: "bg-purple-500",
    label: "Rest",
  },
  other: {
    bg: "bg-gray-100",
    border: "border-gray-200",
    text: "text-gray-700",
    dot: "bg-gray-400",
    label: "Other",
  },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const HOUR_HEIGHT = 80;
const START_HOUR = 6;
const END_HOUR = 23;
const TIME_COL_WIDTH = 52;
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

const hours = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, i) => START_HOUR + i
);

// Time select options: 4 AM to 11 PM in 1-hour increments
const TIME_OPTIONS = Array.from({ length: 20 }, (_, i) => {
  const hour = i + 4;
  const value = `${String(hour).padStart(2, "0")}:00`;
  const label =
    hour === 12
      ? "12:00 PM"
      : hour < 12
      ? `${hour}:00 AM`
      : `${hour - 12}:00 PM`;
  return { value, label };
});

const CATEGORY_ORDER: ActivityCategory[] = [
  "activity",
  "restaurant",
  "hotel",
  "flight",
  "transport",
  "shopping",
  "rest",
  "other",
];

// ─── Types ────────────────────────────────────────────────────────────────────

type DayWithActivities = TripDay & { trip_activities: TripActivity[] };

type ActivityFormData = {
  title: string;
  category: ActivityCategory;
  start_time: string;
  end_time: string;
  location: string;
  description: string;
  cost: string;
};

type EditorState = {
  dayId: string;
  dayDate: string;
  activity: TripActivity | null;
  form: ActivityFormData;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatDisplayTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

function formatHourLabel(hour: number): string {
  if (hour === 12) return "12 PM";
  return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
}

function getCategoryConfig(category: string) {
  return CATEGORY_CONFIG[category as ActivityCategory] ?? CATEGORY_CONFIG.other;
}

function getActivityPosition(
  activity: TripActivity
): { top: number; height: number } | null {
  if (!activity.start_time) return null;
  const startMinutes = timeToMinutes(activity.start_time);
  const startHour = startMinutes / 60;
  if (startHour < START_HOUR || startHour >= END_HOUR) return null;
  const top = (startHour - START_HOUR) * HOUR_HEIGHT;
  let height: number;
  if (activity.end_time) {
    const durationMinutes = Math.max(
      timeToMinutes(activity.end_time) - startMinutes,
      30
    );
    height = Math.max((durationMinutes / 60) * HOUR_HEIGHT - 4, 32);
  } else {
    height = HOUR_HEIGHT - 6;
  }
  return { top, height };
}

function makeDefaultForm(hour: number): ActivityFormData {
  const endHour = Math.min(hour + 1, END_HOUR);
  return {
    title: "",
    category: "activity",
    start_time: `${String(hour).padStart(2, "0")}:00`,
    end_time: `${String(endHour).padStart(2, "0")}:00`,
    location: "",
    description: "",
    cost: "",
  };
}

// ─── Activity Editor Modal ────────────────────────────────────────────────────

function ActivityEditorModal({
  editorState,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  editorState: EditorState;
  saving: boolean;
  onClose: () => void;
  onSave: (form: ActivityFormData) => void;
  onDelete: () => void;
}) {
  const [form, setForm] = useState<ActivityFormData>(editorState.form);
  const isEditing = !!editorState.activity;

  const dayLabel = new Date(
    editorState.dayDate + "T00:00:00"
  ).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl w-full sm:max-w-md flex flex-col max-h-[92vh] sm:max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="font-semibold text-base">
              {isEditing ? "Edit Activity" : "Add Activity"}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {dayLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
          {/* Category selector */}
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Type
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORY_ORDER.map((cat) => {
                const config = CATEGORY_CONFIG[cat];
                const isSelected = form.category === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setForm({ ...form, category: cat })}
                    className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 text-center transition-all ${
                      isSelected
                        ? `${config.bg} ${config.border} ${config.text}`
                        : "border-gray-100 text-gray-500 hover:border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        isSelected ? config.dot : "bg-gray-300"
                      }`}
                    />
                    <span className="text-[10px] leading-tight font-medium">
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              autoFocus
              type="text"
              placeholder="What are you doing?"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
            />
          </div>

          {/* Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Start time
              </label>
              <select
                value={form.start_time}
                onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                End time
              </label>
              <select
                value={form.end_time}
                onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
              >
                {TIME_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Location{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Where is this?"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Notes{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Any details or reminders…"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
            />
          </div>

          {/* Cost */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Estimated cost{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                $
              </span>
              <input
                type="number"
                placeholder="0"
                min="0"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                className="w-full h-10 pl-7 pr-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 gap-3 flex-shrink-0">
          {/* Delete (only in edit mode) */}
          {isEditing ? (
            <button
              onClick={onDelete}
              disabled={saving}
              className="text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
            >
              Delete activity
            </button>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(form)}
              disabled={saving || !form.title.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--color-brand-600)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {saving ? "Saving…" : isEditing ? "Save changes" : "Add activity"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Activity detail panel (read mode) ───────────────────────────────────────


// ─── List view ────────────────────────────────────────────────────────────────

function ListView({ days }: { days: DayWithActivities[] }) {
  return (
    <div className="space-y-8">
      {days.map((day) => (
        <div key={day.id}>
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-sm font-bold text-[var(--color-brand-600)]">
              DAY {day.day_number}
            </span>
            <h2 className="text-lg font-semibold">
              {day.title || `Day ${day.day_number}`}
            </h2>
            <span className="text-sm text-[var(--color-text-muted)]">
              {new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
          {day.notes && (
            <p className="text-sm text-[var(--color-text-muted)] mb-4 italic">
              {day.notes}
            </p>
          )}
          <div className="space-y-2 ml-4 border-l-2 border-[var(--color-border)] pl-6">
            {[...(day.trip_activities ?? [])]
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((activity) => {
                const config = getCategoryConfig(activity.category);
                return (
                  <div
                    key={activity.id}
                    className={`rounded-lg border ${config.border} ${config.bg} p-4`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${config.dot}`}
                        />
                        <div>
                          <h3 className={`font-medium text-sm ${config.text}`}>
                            {activity.title}
                          </h3>
                          {activity.description && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                              {activity.description}
                            </p>
                          )}
                          {activity.location && (
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                              📍 {activity.location}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        {activity.start_time && (
                          <p className="text-xs font-medium text-[var(--color-text-muted)]">
                            {formatDisplayTime(activity.start_time)}
                            {activity.end_time &&
                              ` – ${formatDisplayTime(activity.end_time)}`}
                          </p>
                        )}
                        {activity.cost_cents && (
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                            ${(activity.cost_cents / 100).toFixed(0)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Inline edit cell ────────────────────────────────────────────────────────

function isGoogleMapsUrl(text: string) {
  return /^https?:\/\/(maps\.app\.goo\.gl|maps\.google\.com|www\.google\.com\/maps)/.test(
    text.trim()
  );
}

// Stored format: "Place Name||https://maps.app.goo.gl/xxx"
function parseStoredValue(value: string): { name: string; url?: string } {
  const idx = value.indexOf("||");
  if (idx === -1) return { name: value };
  return { name: value.slice(0, idx), url: value.slice(idx + 2) };
}

function formatStoredValue(name: string, url?: string): string {
  return url ? `${name}||${url}` : name;
}

function InlineEditCell({
  value,
  placeholder,
  onSave,
  enableUrlResolve = false,
}: {
  value: string | null;
  placeholder: string;
  onSave: (v: string) => void;
  enableUrlResolve?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(
    () => parseStoredValue(value ?? "").name
  );
  const [resolving, setResolving] = useState(false);
  // Prevents onBlur from saving while an async resolve is in flight
  const pendingResolve = useRef(false);

  useEffect(() => {
    if (!editing) setLocalValue(parseStoredValue(value ?? "").name);
  }, [value, editing]);

  async function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    if (!enableUrlResolve) return;
    const pasted = e.clipboardData.getData("text").trim();
    if (!isGoogleMapsUrl(pasted)) return;

    e.preventDefault();
    pendingResolve.current = true;
    setResolving(true);

    try {
      const res = await fetch(
        `/api/places/lookup?url=${encodeURIComponent(pasted)}`
      );
      const data = await res.json();
      const resolved = data.name as string | undefined;
      if (resolved) {
        // Store "name||url" so the name is clickable later
        const stored = formatStoredValue(resolved, pasted);
        onSave(stored);
        setLocalValue(resolved);
        setEditing(false);
      }
    } catch {
      // Let the user type the name manually if lookup fails
    } finally {
      pendingResolve.current = false;
      setResolving(false);
    }
  }

  // Parse stored value for idle display
  const { name: displayName, url: displayUrl } = parseStoredValue(value ?? "");

  return editing ? (
    <div className="relative min-h-[34px]">
      {resolving && (
        <div className="absolute inset-0 flex items-center gap-2 px-3 bg-white z-10">
          <div className="w-3 h-3 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin shrink-0" />
          <span className="text-xs text-gray-400">Looking up place…</span>
        </div>
      )}
      <input
        autoFocus
        value={localValue}
        disabled={resolving}
        onChange={(e) => setLocalValue(e.target.value)}
        onPaste={handlePaste}
        onBlur={() => {
          if (!pendingResolve.current) {
            setEditing(false);
            onSave(localValue);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setLocalValue(parseStoredValue(value ?? "").name);
            setEditing(false);
          }
        }}
        className="w-full px-3 py-1.5 text-sm bg-transparent focus:outline-none focus:bg-blue-50/50 min-h-[34px]"
        placeholder={placeholder}
      />
    </div>
  ) : (
    <div
      onClick={() => setEditing(true)}
      className="px-3 py-1.5 text-sm cursor-text hover:bg-black/[0.03] min-h-[34px] flex items-center group overflow-hidden"
    >
      {displayName ? (
        displayUrl ? (
          <a
            href={displayUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="truncate text-blue-600 hover:text-blue-800 underline underline-offset-2 decoration-blue-300 hover:decoration-blue-600 transition-colors"
          >
            {displayName}
          </a>
        ) : (
          <span className="truncate">{displayName}</span>
        )
      ) : (
        <span className="text-gray-300 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
          {placeholder}
        </span>
      )}
    </div>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

function CalendarGrid({
  days,
  onCellClick,
  onActivityEdit,
  onUpdateDayField,
}: {
  days: DayWithActivities[];
  onCellClick?: (dayId: string, dayDate: string, startHour: number, endHour: number) => void;
  onActivityEdit?: (activity: TripActivity, dayId: string) => void;
  onUpdateDayField?: (dayId: string, field: "title" | "notes", value: string) => void;
}) {
  // Drag-to-select state
  const [dragState, setDragState] = useState<{
    dayId: string;
    dayDate: string;
    startHour: number;
    currentHour: number;
  } | null>(null);

  const hasUnscheduled = days.some((d) =>
    d.trip_activities?.some((a) => {
      if (!a.start_time) return true;
      const h = timeToMinutes(a.start_time) / 60;
      return h < START_HOUR || h >= END_HOUR;
    })
  );

  function getHourFromY(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    return Math.min(
      Math.max(Math.floor(y / HOUR_HEIGHT) + START_HOUR, START_HOUR),
      END_HOUR - 1
    );
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>, day: DayWithActivities) {
    if (!onCellClick) return;
    const hour = getHourFromY(e);
    setDragState({ dayId: day.id, dayDate: day.date, startHour: hour, currentHour: hour });
  }

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!dragState) return;
    const hour = getHourFromY(e);
    if (hour !== dragState.currentHour) {
      setDragState({ ...dragState, currentHour: hour });
    }
  }

  function handleMouseUp() {
    if (!dragState || !onCellClick) return;
    const fromHour = Math.min(dragState.startHour, dragState.currentHour);
    const toHour = Math.max(dragState.startHour, dragState.currentHour) + 1;
    onCellClick(dragState.dayId, dragState.dayDate, fromHour, toHour);
    setDragState(null);
  }

  return (
    <div
      className="overflow-x-hidden overflow-y-auto rounded-xl border border-[var(--color-border)] bg-white w-full min-w-0"
      style={{ maxHeight: "78vh" }}
    >
      <div className="flex flex-col w-full min-w-0 overflow-hidden">
        {/* ══ STICKY HEADER GROUP (sticks to top while scrolling down) ══ */}
        <div className="sticky top-0 z-20 flex flex-col">

          {/* Row 1: Day number + date */}
          <div className="flex bg-gray-50 border-b border-[var(--color-border)]">
            <div
              className="sticky left-0 z-10 bg-gray-50 border-r border-[var(--color-border)] flex-shrink-0"
              style={{ width: TIME_COL_WIDTH }}
            />
            {days.map((day) => {
              const d = new Date(day.date + "T00:00:00");
              return (
                <div
                  key={day.id}
                  className="flex-1 min-w-0 border-r border-[var(--color-border)] last:border-r-0"
                >
                  {/* Compact header that works at any width */}
                  <div className="flex flex-col items-center justify-center py-2 gap-0.5">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                      {d.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span className="text-base font-bold text-[var(--color-brand-600)] leading-none">
                      {d.getDate()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row 2: City */}
          <div className="flex bg-white border-b border-[var(--color-border)]">
            <div
              className="sticky left-0 z-10 bg-white border-r border-[var(--color-border)] flex-shrink-0 flex items-center justify-end pr-2"
              style={{ width: TIME_COL_WIDTH }}
            >
              <span className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                City
              </span>
            </div>
            {days.map((day) => (
              <div
                key={day.id}
                className="flex-1 min-w-0 border-r border-[var(--color-border)] last:border-r-0"
              >
                <InlineEditCell
                  value={day.title}
                  placeholder="Add city…"
                  onSave={(v) => onUpdateDayField?.(day.id, "title", v)}
                />
              </div>
            ))}
          </div>

          {/* Row 3: Hotel */}
          <div className="flex border-b border-[var(--color-border)]" style={{ backgroundColor: "rgb(255 247 237 / 0.5)" }}>
            <div
              className="sticky left-0 z-10 border-r border-[var(--color-border)] flex-shrink-0 flex items-center justify-end pr-2"
              style={{ width: TIME_COL_WIDTH, backgroundColor: "rgb(255 247 237 / 0.5)" }}
            >
              <span className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">
                Hotel
              </span>
            </div>
            {days.map((day) => (
              <div
                key={day.id}
                className="flex-1 min-w-0 border-r border-[var(--color-border)] last:border-r-0"
              >
                <InlineEditCell
                  value={day.notes}
                  placeholder="Add hotel or paste Maps link…"
                  onSave={(v) => onUpdateDayField?.(day.id, "notes", v)}
                  enableUrlResolve
                />
              </div>
            ))}
          </div>

        </div>

        {/* ══ SCROLLABLE BODY ══ */}
        <div className="flex">

          {/* Left time column (sticky left) */}
          <div
            className="sticky left-0 z-10 bg-white border-r border-[var(--color-border)] flex-shrink-0"
            style={{ width: TIME_COL_WIDTH }}
          >
            {hasUnscheduled && (
              <div
                className="bg-gray-50/60 border-b border-[var(--color-border)] flex items-center justify-center"
                style={{ height: 44 }}
              >
                <span className="text-[9px] leading-tight text-center text-[var(--color-text-muted)] px-1">
                  Any
                  <br />
                  time
                </span>
              </div>
            )}
            <div className="relative" style={{ height: TOTAL_HEIGHT }}>
              {hours.map((hour) => (
                <div
                  key={hour}
                  className="absolute w-full flex items-start justify-end pr-2 pt-1"
                  style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                >
                  <span className="text-[9px] text-[var(--color-text-muted)] tabular-nums leading-none whitespace-nowrap">
                    {formatHourLabel(hour)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Day columns (time grids) */}
          <div className="flex flex-1 min-w-0">
            {days.map((day) => {
              const activities = day.trip_activities ?? [];
              const unscheduled = activities.filter((a) => {
                if (!a.start_time) return true;
                const h = timeToMinutes(a.start_time) / 60;
                return h < START_HOUR || h >= END_HOUR;
              });

              return (
                <div
                  key={day.id}
                  className="flex-1 min-w-0 border-r border-[var(--color-border)] last:border-r-0"
                >
                  {/* Anytime row */}
                  {hasUnscheduled && (
                    <div
                      className="bg-gray-50/40 border-b border-[var(--color-border)] p-1 flex flex-wrap gap-1 items-center overflow-hidden"
                      style={{ height: 44 }}
                    >
                      {unscheduled.map((activity) => {
                        const config = getCategoryConfig(activity.category);
                        return (
                          <button
                            key={activity.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onActivityEdit?.(activity, day.id);
                            }}
                            className={`text-[10px] px-1.5 py-0.5 rounded-full border leading-tight truncate max-w-full ${config.bg} ${config.border} ${config.text}`}
                          >
                            {activity.title}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => onCellClick?.(day.id, day.date, START_HOUR, START_HOUR + 1)}
                        className="text-[10px] text-gray-400 hover:text-gray-600 px-1"
                        title="Add activity"
                      >
                        +
                      </button>
                    </div>
                  )}

                  {/* Time grid */}
                  <div
                    className="relative cursor-pointer select-none"
                    style={{ height: TOTAL_HEIGHT }}
                    onMouseDown={(e) => handleMouseDown(e, day)}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={() => dragState?.dayId === day.id && handleMouseUp()}
                  >
                    {/* Hour gridlines */}
                    {hours.map((hour) => (
                      <div
                        key={hour}
                        className="absolute w-full border-t border-gray-100"
                        style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
                      />
                    ))}
                    {/* Half-hour lines */}
                    {hours.map((hour) => (
                      <div
                        key={`${hour}-half`}
                        className="absolute w-full border-t border-gray-50"
                        style={{ top: (hour - START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                      />
                    ))}
                    {/* Drag selection highlight */}
                    {dragState?.dayId === day.id && (() => {
                      const fromH = Math.min(dragState.startHour, dragState.currentHour);
                      const toH = Math.max(dragState.startHour, dragState.currentHour) + 1;
                      return (
                        <div
                          className="absolute inset-x-1 rounded-lg bg-blue-100/60 border-2 border-blue-300 pointer-events-none z-10"
                          style={{
                            top: (fromH - START_HOUR) * HOUR_HEIGHT,
                            height: (toH - fromH) * HOUR_HEIGHT,
                          }}
                        />
                      );
                    })()}
                    {/* Hover overlay */}
                    <div className="absolute inset-0 hover:bg-blue-50/20 transition-colors pointer-events-none" />

                    {/* Activity cards */}
                    {activities.map((activity) => {
                      const pos = getActivityPosition(activity);
                      if (!pos) return null;
                      const config = getCategoryConfig(activity.category);

                      return (
                        <button
                          key={activity.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onActivityEdit?.(activity, day.id);
                          }}
                          className={`absolute inset-x-1 rounded-lg border text-left overflow-hidden transition-all group hover:shadow-md hover:z-10 z-0 ${config.bg} ${config.border} ${config.text}`}
                          style={{ top: pos.top + 2, height: pos.height }}
                        >
                          <div className="p-1.5 h-full flex flex-col">
                            <span className="text-[11px] font-semibold leading-tight line-clamp-2 flex-1">
                              {activity.title}
                            </span>
                            {pos.height >= 52 && activity.start_time && (
                              <span className="text-[9px] opacity-60 mt-1 shrink-0">
                                {formatDisplayTime(activity.start_time)}
                                {activity.end_time &&
                                  ` – ${formatDisplayTime(activity.end_time)}`}
                              </span>
                            )}
                            <span className="absolute top-1 right-1 text-[10px] opacity-0 group-hover:opacity-70 transition-opacity">
                              ✏️
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function TripCalendarView({
  days: initialDays,
}: {
  days: DayWithActivities[];
}) {
  const supabase = createClient();
  const userId = useOwnerId();

  const [days, setDays] = useState<DayWithActivities[]>(initialDays);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const MOBILE_PAGE_SIZE = 5;

  function openAddEditor(dayId: string, dayDate: string, startHour: number, endHour: number) {
    setEditorState({
      dayId,
      dayDate,
      activity: null,
      form: {
        title: "",
        category: "activity",
        start_time: `${String(startHour).padStart(2, "0")}:00`,
        end_time: `${String(Math.min(endHour, END_HOUR)).padStart(2, "0")}:00`,
        location: "",
        description: "",
        cost: "",
      },
    });
  }

  function openEditEditor(activity: TripActivity, dayId: string) {
    const day = days.find((d) => d.id === dayId);
    setEditorState({
      dayId,
      dayDate: day?.date ?? "",
      activity,
      form: {
        title: activity.title,
        category: activity.category,
        start_time:
          activity.start_time ??
          `${String(START_HOUR).padStart(2, "0")}:00`,
        end_time:
          activity.end_time ??
          `${String(START_HOUR + 1).padStart(2, "0")}:00`,
        location: activity.location ?? "",
        description: activity.description ?? "",
        cost: activity.cost_cents
          ? String(activity.cost_cents / 100)
          : "",
      },
    });
  }

  async function handleSave(form: ActivityFormData) {
    if (!editorState || !userId) return;
    setSaving(true);

    try {
      if (editorState.activity) {
        // Update existing activity
        const updates = {
          title: form.title.trim(),
          category: form.category,
          start_time: form.start_time || null,
          end_time: form.end_time || null,
          location: form.location.trim() || null,
          description: form.description.trim() || null,
          cost_cents: form.cost
            ? Math.round(parseFloat(form.cost) * 100)
            : null,
        };
        const { error } = await supabase
          .from("trip_activities")
          .update(updates)
          .eq("id", editorState.activity.id);

        if (!error) {
          const actId = editorState.activity.id;
          const dayId = editorState.dayId;
          setDays((prev) =>
            prev.map((d) =>
              d.id === dayId
                ? {
                    ...d,
                    trip_activities: d.trip_activities.map((a) =>
                      a.id === actId ? { ...a, ...updates } : a
                    ),
                  }
                : d
            )
          );
          setEditorState(null);
        }
      } else {
        // Insert new activity
        const payload = {
          trip_day_id: editorState.dayId,
          user_id: userId,
          title: form.title.trim(),
          category: form.category,
          start_time: form.start_time || null,
          end_time: form.end_time || null,
          location: form.location.trim() || null,
          description: form.description.trim() || null,
          cost_cents: form.cost
            ? Math.round(parseFloat(form.cost) * 100)
            : null,
          sort_order: days.find((d) => d.id === editorState.dayId)?.trip_activities.length ?? 0,
        };
        const { data, error } = await supabase
          .from("trip_activities")
          .insert(payload)
          .select()
          .single();

        if (!error && data) {
          setDays((prev) =>
            prev.map((d) =>
              d.id === editorState.dayId
                ? {
                    ...d,
                    trip_activities: [...d.trip_activities, data],
                  }
                : d
            )
          );
          setEditorState(null);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!editorState?.activity) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("trip_activities")
        .delete()
        .eq("id", editorState.activity.id);

      if (!error) {
        const { dayId } = editorState;
        const actId = editorState.activity.id;
        setDays((prev) =>
          prev.map((d) =>
            d.id === dayId
              ? {
                  ...d,
                  trip_activities: d.trip_activities.filter(
                    (a) => a.id !== actId
                  ),
                }
              : d
          )
        );
        setEditorState(null);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateDayField(
    dayId: string,
    field: "title" | "notes",
    value: string
  ) {
    const updateValue = value.trim() || null;
    setDays((prev) =>
      prev.map((d) => (d.id === dayId ? { ...d, [field]: updateValue } : d))
    );
    await supabase.from("trip_days").update({ [field]: updateValue }).eq("id", dayId);
  }

  const totalPages = Math.ceil(days.length / MOBILE_PAGE_SIZE);
  const pagedDays = days.slice(page * MOBILE_PAGE_SIZE, (page + 1) * MOBILE_PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4 min-w-0 w-full">
      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Legend — hidden on mobile to save space */}
        <div className="hidden sm:flex flex-wrap gap-x-4 gap-y-1.5">
          {CATEGORY_ORDER.map((cat) => {
            const config = CATEGORY_CONFIG[cat];
            return (
              <div key={cat} className="flex items-center gap-1.5">
                <div className={`w-2.5 h-2.5 rounded-sm ${config.dot}`} />
                <span className="text-xs text-[var(--color-text-muted)]">
                  {config.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden text-sm ml-auto">
          <button
            onClick={() => setView("calendar")}
            className={`px-3 py-1.5 transition-colors ${
              view === "calendar"
                ? "bg-[var(--color-brand-600)] text-white font-medium"
                : "text-[var(--color-text-muted)] hover:bg-gray-50"
            }`}
          >
            Calendar
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 transition-colors border-l border-[var(--color-border)] ${
              view === "list"
                ? "bg-[var(--color-brand-600)] text-white font-medium"
                : "text-[var(--color-text-muted)] hover:bg-gray-50"
            }`}
          >
            List
          </button>
        </div>
      </div>

      {/* Activity editor modal */}
      {editorState && (
        <ActivityEditorModal
          editorState={editorState}
          saving={saving}
          onClose={() => setEditorState(null)}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      )}

      {/* Pagination controls */}
      {view === "calendar" && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 bg-gray-50 rounded-xl px-4 py-2 border border-[var(--color-border)]">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 transition-colors text-xl leading-none"
          >
            ‹
          </button>
          <span className="text-xs text-[var(--color-text-muted)]">
            Days {page * MOBILE_PAGE_SIZE + 1}–{Math.min((page + 1) * MOBILE_PAGE_SIZE, days.length)} of {days.length}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page === totalPages - 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200 disabled:opacity-30 transition-colors text-xl leading-none"
          >
            ›
          </button>
        </div>
      )}

      {/* View content */}
      {view === "calendar" ? (
        <CalendarGrid
          days={pagedDays}
          onCellClick={openAddEditor}
          onActivityEdit={openEditEditor}
          onUpdateDayField={handleUpdateDayField}
        />
      ) : (
        <ListView days={days} />
      )}
    </div>
  );
}
