"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOwnerId } from "@/lib/household-context";
import type { TripDay, TripActivity, ActivityCategory } from "@/types";
import { PlacesInput } from "@/components/ui/places-input";

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
const START_HOUR = 1;
const END_HOUR = 24;
const TIME_COL_WIDTH = 52;
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

// +1 to include midnight label at the very bottom
const hours = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i
);

// Time select options: 1 AM to 12 AM (midnight)
const TIME_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const hour = i + 1;
  const value = `${String(hour === 24 ? 0 : hour).padStart(2, "0")}:00`;
  const label =
    hour === 24
      ? "12:00 AM"
      : hour === 12
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

// ─── Timezone list ────────────────────────────────────────────────────────────

const COMMON_TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Chicago", label: "Chicago (CT)" },
  { value: "America/Denver", label: "Denver (MT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "America/Anchorage", label: "Anchorage (AKT)" },
  { value: "Pacific/Honolulu", label: "Honolulu (HT)" },
  { value: "America/Toronto", label: "Toronto (ET)" },
  { value: "America/Vancouver", label: "Vancouver (PT)" },
  { value: "America/Mexico_City", label: "Mexico City (CT)" },
  { value: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { value: "America/Buenos_Aires", label: "Buenos Aires (ART)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Lisbon", label: "Lisbon (WET/WEST)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (CET)" },
  { value: "Europe/Rome", label: "Rome (CET)" },
  { value: "Europe/Madrid", label: "Madrid (CET)" },
  { value: "Europe/Athens", label: "Athens (EET)" },
  { value: "Europe/Istanbul", label: "Istanbul (TRT)" },
  { value: "Africa/Cairo", label: "Cairo (EET)" },
  { value: "Africa/Johannesburg", label: "Johannesburg (SAST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Asia/Bangkok", label: "Bangkok (ICT)" },
  { value: "Asia/Singapore", label: "Singapore (SGT)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Seoul", label: "Seoul (KST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Kolkata", label: "Mumbai/Delhi (IST)" },
  { value: "Australia/Sydney", label: "Sydney (AEDT)" },
  { value: "Pacific/Auckland", label: "Auckland (NZST)" },
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
  link: string;
  sync_to_gcal: boolean;
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
  if (hour === 0 || hour === 24) return "12 AM";
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

const SNAP_MINUTES = 15;

function snapToGrid(minutes: number): number {
  return Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  return `${displayH}:${String(m).padStart(2, "0")} ${ampm}`;
}

type ActDragState = {
  type: "move" | "resize";
  activityId: string;
  activity: TripActivity;
  dayId: string;
  grabOffsetMinutes: number;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  columnTop: number;
};

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
    link: "",
    sync_to_gcal: false,
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
              type="text"
              placeholder="What are you doing?"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
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
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
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
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
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
            <PlacesInput
              value={form.location}
              onChange={(location, mapsUrl) => {
                setForm((f) => ({
                  ...f,
                  location,
                  // Set Maps URL when place selected, clear when location cleared
                  link: mapsUrl !== undefined ? (mapsUrl ?? "") : location ? f.link : "",
                }));
              }}
              placeholder="Where is this?"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
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
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-base resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
            />
          </div>

          {/* Google Calendar sync */}
          <label className="flex items-center gap-3 cursor-pointer select-none group">
            <div className="relative flex-shrink-0">
              <input
                type="checkbox"
                checked={form.sync_to_gcal}
                onChange={(e) => setForm({ ...form, sync_to_gcal: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-9 h-5 rounded-full border border-gray-200 bg-gray-100 peer-checked:bg-[var(--color-brand-600)] peer-checked:border-[var(--color-brand-600)] transition-colors" />
              <div className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
            </div>
            <div>
              <p className="text-sm font-medium leading-none">Sync with Google Calendar</p>
              <p className="text-xs text-gray-400 mt-0.5">Get notifications for this event</p>
            </div>
          </label>

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
        className="w-full px-3 py-1.5 text-base bg-transparent focus:outline-none focus:bg-blue-50/50 min-h-[34px]"
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

// ─── Timezone selector ───────────────────────────────────────────────────────

function TimezoneSelector({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (tz: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isSet = value !== null;
  const label = isSet
    ? (COMMON_TIMEZONES.find((tz) => tz.value === value)?.label ?? value)
    : null;

  if (!isSet && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs border border-dashed border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-[var(--color-text-muted)] hover:border-[var(--color-brand-600)] hover:text-[var(--color-brand-600)] transition-colors shrink-0 whitespace-nowrap"
      >
        Set timezone
      </button>
    );
  }

  if (isSet && !open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 bg-white text-[var(--color-text-muted)] hover:border-[var(--color-brand-600)] hover:text-[var(--color-text)] transition-colors shrink-0 flex items-center gap-1.5 max-w-[160px]"
        title="Click to change timezone"
      >
        <span className="truncate">{label!}</span>
        <span className="opacity-40 shrink-0">✎</span>
      </button>
    );
  }

  return (
    <select
      autoFocus
      value={value ?? "UTC"}
      onChange={(e) => {
        onChange(e.target.value);
        setOpen(false);
      }}
      onBlur={() => setOpen(false)}
      className="text-xs border border-[var(--color-brand-600)] rounded-lg px-2 py-1.5 bg-white text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 max-w-[160px] shrink-0"
    >
      {COMMON_TIMEZONES.map((tz) => (
        <option key={tz.value} value={tz.value}>{tz.label}</option>
      ))}
    </select>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

function CalendarGrid({
  days,
  onCellClick,
  onActivityEdit,
  onUpdateDayField,
  onActivityTimeUpdate,
}: {
  days: DayWithActivities[];
  onCellClick?: (dayId: string, dayDate: string, startHour: number, endHour: number) => void;
  onActivityEdit?: (activity: TripActivity, dayId: string) => void;
  onUpdateDayField?: (dayId: string, field: "title" | "notes", value: string) => void;
  onActivityTimeUpdate?: (activityId: string, dayId: string, startTime: string, endTime: string) => void;
}) {
  // Drag-to-select (create) state
  const [dragState, setDragState] = useState<{
    dayId: string;
    dayDate: string;
    startHour: number;
    currentHour: number;
  } | null>(null);

  // Scroll to 8 AM on mount
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = (8 - START_HOUR) * HOUR_HEIGHT;
    }
  }, []);

  // Activity drag (move/resize) state
  const [actDrag, setActDrag] = useState<ActDragState | null>(null);
  const actDragRef = useRef<ActDragState | null>(null);
  const dragMovedRef = useRef(false);
  const dragStartPosRef = useRef({ x: 0, y: 0 });

  // Touch long-press drag refs
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchDragStartRef = useRef<{
    clientX: number;
    clientY: number;
    activity: TripActivity;
    dayId: string;
    columnTop: number;
    cardTop: number;
  } | null>(null);
  const isTouchDraggingRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    actDragRef.current = actDrag;
  }, [actDrag]);

  // Global mouse + touch handlers for activity drag
  useEffect(() => {
    if (!actDrag) return;

    function updateDragFromClientY(clientY: number) {
      setActDrag((prev) => {
        if (!prev) return null;
        const rawMinutes =
          ((clientY - prev.columnTop) / HOUR_HEIGHT) * 60 + START_HOUR * 60;
        if (prev.type === "move") {
          const snapped = snapToGrid(rawMinutes - prev.grabOffsetMinutes);
          const clamped = Math.max(
            START_HOUR * 60,
            Math.min(END_HOUR * 60 - prev.durationMinutes, snapped)
          );
          return { ...prev, startMinutes: clamped, endMinutes: clamped + prev.durationMinutes };
        } else {
          const snapped = snapToGrid(rawMinutes);
          const clamped = Math.max(
            prev.startMinutes + SNAP_MINUTES,
            Math.min(END_HOUR * 60, snapped)
          );
          return { ...prev, endMinutes: clamped };
        }
      });
    }

    function onMove(e: MouseEvent) {
      if (!dragMovedRef.current) {
        const dx = e.clientX - dragStartPosRef.current.x;
        const dy = e.clientY - dragStartPosRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) > 5) dragMovedRef.current = true;
      }
      updateDragFromClientY(e.clientY);
    }

    function onUp() {
      const drag = actDragRef.current;
      if (!drag) return;
      if (dragMovedRef.current) {
        onActivityTimeUpdate?.(
          drag.activityId,
          drag.dayId,
          minutesToTime(drag.startMinutes),
          minutesToTime(drag.endMinutes)
        );
      } else {
        onActivityEdit?.(drag.activity, drag.dayId);
      }
      setActDrag(null);
      dragMovedRef.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (!isTouchDraggingRef.current) return;
      e.preventDefault(); // block scroll while dragging
      updateDragFromClientY(e.touches[0].clientY);
    }

    function onTouchEnd() {
      if (!isTouchDraggingRef.current) return;
      const drag = actDragRef.current;
      if (drag) {
        onActivityTimeUpdate?.(
          drag.activityId,
          drag.dayId,
          minutesToTime(drag.startMinutes),
          minutesToTime(drag.endMinutes)
        );
      }
      setActDrag(null);
      isTouchDraggingRef.current = false;
      touchDragStartRef.current = null;
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!actDrag]);

  function getHourFromY(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    return Math.min(
      Math.max(Math.floor(y / HOUR_HEIGHT) + START_HOUR, START_HOUR),
      END_HOUR - 1
    );
  }

  function handleMouseDown(e: React.MouseEvent<HTMLDivElement>, day: DayWithActivities) {
    if (!onCellClick || actDrag) return;
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

  function startActivityMove(
    e: React.MouseEvent,
    activity: TripActivity,
    dayId: string
  ) {
    e.stopPropagation();
    if (!activity.start_time) { onActivityEdit?.(activity, dayId); return; }
    const startMins = timeToMinutes(activity.start_time);
    const endMins = activity.end_time ? timeToMinutes(activity.end_time) : startMins + 60;
    const cardRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = getActivityPosition(activity)!;
    const columnTop = cardRect.top - pos.top - 2;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    dragMovedRef.current = false;
    setActDrag({
      type: "move",
      activityId: activity.id,
      activity,
      dayId,
      grabOffsetMinutes: ((e.clientY - cardRect.top) / HOUR_HEIGHT) * 60,
      startMinutes: startMins,
      endMinutes: endMins,
      durationMinutes: endMins - startMins,
      columnTop,
    });
  }

  function startActivityResize(
    e: React.MouseEvent,
    activity: TripActivity,
    dayId: string
  ) {
    e.stopPropagation();
    if (!activity.start_time) return;
    const startMins = timeToMinutes(activity.start_time);
    const endMins = activity.end_time ? timeToMinutes(activity.end_time) : startMins + 60;
    const card = (e.currentTarget as HTMLElement).closest("[data-act]") as HTMLElement;
    const cardRect = card.getBoundingClientRect();
    const pos = getActivityPosition(activity)!;
    const columnTop = cardRect.top - pos.top - 2;
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };
    dragMovedRef.current = false;
    setActDrag({
      type: "resize",
      activityId: activity.id,
      activity,
      dayId,
      grabOffsetMinutes: 0,
      startMinutes: startMins,
      endMinutes: endMins,
      durationMinutes: endMins - startMins,
      columnTop,
    });
  }

  // ── Touch long-press drag (mobile) ───────────────────────────────────────

  function cancelTouchLongPress() {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
    if (!isTouchDraggingRef.current) touchDragStartRef.current = null;
  }

  function startActivityTouchDown(
    e: React.TouchEvent,
    activity: TripActivity,
    dayId: string
  ) {
    if (!activity.start_time) return;
    const touch = e.touches[0];
    const cardEl = e.currentTarget as HTMLElement;
    const cardRect = cardEl.getBoundingClientRect();
    const pos = getActivityPosition(activity);
    if (!pos) return;
    const columnTop = cardRect.top - pos.top - 2;

    touchDragStartRef.current = {
      clientX: touch.clientX,
      clientY: touch.clientY,
      activity,
      dayId,
      columnTop,
      cardTop: cardRect.top,
    };
    isTouchDraggingRef.current = false;

    touchTimerRef.current = setTimeout(() => {
      const info = touchDragStartRef.current;
      if (!info) return;
      isTouchDraggingRef.current = true;
      if (navigator.vibrate) navigator.vibrate(50);

      const startMins = timeToMinutes(info.activity.start_time!);
      const endMins = info.activity.end_time
        ? timeToMinutes(info.activity.end_time)
        : startMins + 60;

      dragMovedRef.current = true;
      dragStartPosRef.current = { x: info.clientX, y: info.clientY };

      setActDrag({
        type: "move",
        activityId: info.activity.id,
        activity: info.activity,
        dayId: info.dayId,
        grabOffsetMinutes: ((info.clientY - info.cardTop) / HOUR_HEIGHT) * 60,
        startMinutes: startMins,
        endMinutes: endMins,
        durationMinutes: endMins - startMins,
        columnTop: info.columnTop,
      });
    }, 400);
  }

  function handleCardTouchMove(e: React.TouchEvent) {
    if (isTouchDraggingRef.current) return; // handled by global listener
    if (!touchDragStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchDragStartRef.current.clientX;
    const dy = touch.clientY - touchDragStartRef.current.clientY;
    // If user starts scrolling before long-press fires, cancel the timer
    if (Math.sqrt(dx * dx + dy * dy) > 8) cancelTouchLongPress();
  }

  function handleCardTouchEnd() {
    if (!isTouchDraggingRef.current) cancelTouchLongPress();
  }

  return (
    <div
      ref={scrollContainerRef}
      className="overflow-auto rounded-xl border border-[var(--color-border)] bg-white w-full min-w-0"
      style={{ maxHeight: "78vh" }}
    >
      <div className="flex flex-col min-w-0">
        {/* ══ STICKY DATE ROW (sticks to top while scrolling down) ══ */}
        <div className="sticky top-0 z-20 flex bg-gray-50 border-b border-[var(--color-border)]">
          <div
            className="sticky left-0 z-10 bg-gray-50 border-r border-[var(--color-border)] flex-shrink-0"
            style={{ width: TIME_COL_WIDTH }}
          />
          {days.map((day) => {
            const d = new Date(day.date + "T00:00:00");
            return (
              <div
                key={day.id}
                className="flex-1 border-r border-[var(--color-border)] last:border-r-0" style={{ minWidth: 100 }}
              >
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
        <div className="flex bg-white border-b border-[var(--color-border)]" style={{ height: 34 }}>
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
              className="flex-1 border-r border-[var(--color-border)] last:border-r-0" style={{ minWidth: 100 }}
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
        <div className="flex border-b border-[var(--color-border)]" style={{ backgroundColor: "rgb(255 247 237 / 0.5)", height: 34 }}>
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
              className="flex-1 border-r border-[var(--color-border)] last:border-r-0" style={{ minWidth: 100 }}
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

        {/* ══ SCROLLABLE BODY ══ */}
        <div className="flex">

          {/* Left time column (sticky left) */}
          <div
            className="sticky left-0 z-10 bg-white border-r border-[var(--color-border)] flex-shrink-0"
            style={{ width: TIME_COL_WIDTH }}
          >
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
              return (
                <div
                  key={day.id}
                  className="flex-1 border-r border-[var(--color-border)] last:border-r-0" style={{ minWidth: 100 }}
                >

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
                      const isDragging = actDrag?.activityId === activity.id;
                      const basePos = getActivityPosition(activity);
                      if (!basePos && !isDragging) return null;

                      const displayStartMins = isDragging ? actDrag!.startMinutes : (activity.start_time ? timeToMinutes(activity.start_time) : START_HOUR * 60);
                      const displayEndMins = isDragging ? actDrag!.endMinutes : (activity.end_time ? timeToMinutes(activity.end_time) : displayStartMins + 60);
                      const displayTop = (displayStartMins / 60 - START_HOUR) * HOUR_HEIGHT + 2;
                      const displayHeight = Math.max(((displayEndMins - displayStartMins) / 60) * HOUR_HEIGHT - 4, 20);

                      if (!isDragging && !basePos) return null;
                      const config = getCategoryConfig(activity.category);

                      return (
                        <div
                          key={activity.id}
                          data-act
                          onMouseDown={(e) => startActivityMove(e, activity, day.id)}
                          onTouchStart={(e) => startActivityTouchDown(e, activity, day.id)}
                          onTouchMove={handleCardTouchMove}
                          onTouchEnd={handleCardTouchEnd}
                          onContextMenu={(e) => e.preventDefault()}
                          className={`absolute inset-x-1 rounded-lg border text-left overflow-hidden select-none group ${
                            isDragging
                              ? "shadow-xl z-30 opacity-90 cursor-grabbing scale-[1.02]"
                              : "hover:shadow-md hover:z-10 z-0 cursor-grab"
                          } ${config.bg} ${config.border} ${config.text} transition-transform`}
                          style={{ top: displayTop, height: displayHeight }}
                        >
                          <div className="p-1.5 h-full flex flex-col overflow-hidden pointer-events-none">
                            <span className="text-[11px] font-semibold leading-tight line-clamp-2">
                              {activity.title}
                            </span>
                            {activity.description && displayHeight >= 48 && !isDragging && (
                              <span className="text-[9px] leading-snug opacity-70 mt-0.5 line-clamp-2">
                                {activity.description}
                              </span>
                            )}
                            {displayHeight >= 36 && (
                              <span className="text-[9px] opacity-60 mt-auto shrink-0">
                                {isDragging
                                  ? `${formatMinutes(actDrag!.startMinutes)} – ${formatMinutes(actDrag!.endMinutes)}`
                                  : activity.start_time
                                  ? `${formatDisplayTime(activity.start_time)}${activity.end_time ? ` – ${formatDisplayTime(activity.end_time)}` : ""}`
                                  : ""}
                              </span>
                            )}
                          </div>
                          {/* Resize handle */}
                          <div
                            onMouseDown={(e) => startActivityResize(e, activity, day.id)}
                            className="absolute bottom-0 left-0 right-0 h-3 cursor-ns-resize flex items-center justify-center pointer-events-auto"
                            title="Drag to resize"
                          >
                            <div className="w-6 h-0.5 rounded-full bg-current opacity-0 group-hover:opacity-30 transition-opacity" />
                          </div>
                        </div>
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
  tripId,
  initialTimezone,
}: {
  days: DayWithActivities[];
  tripId: string;
  initialTimezone: string | null;
}) {
  const supabase = createClient();
  const userId = useOwnerId();

  const [days, setDays] = useState<DayWithActivities[]>(initialDays);
  // null = never set; non-null = explicitly chosen (including "UTC")
  const [timezone, setTimezone] = useState<string | null>(initialTimezone);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(0);
  const MOBILE_PAGE_SIZE = 5;
  const [tappedActivity, setTappedActivity] = useState<{
    activity: TripActivity;
    dayId: string;
  } | null>(null);

  function hourToTimeStr(hour: number): string {
    const h = hour >= 24 ? 0 : hour;
    return `${String(h).padStart(2, "0")}:00`;
  }

  function openAddEditor(dayId: string, dayDate: string, startHour: number, endHour: number) {
    setEditorState({
      dayId,
      dayDate,
      activity: null,
      form: {
        title: "",
        category: "activity",
        start_time: hourToTimeStr(startHour),
        end_time: hourToTimeStr(Math.min(endHour, END_HOUR)),
        location: "",
        description: "",
        cost: "",
        link: "",
        sync_to_gcal: false,
      },
    });
  }

  function handleActivityTap(activity: TripActivity, dayId: string) {
    // If no Maps URL, go straight to edit
    if (!activity.booking_url) {
      openEditEditor(activity, dayId);
      return;
    }
    setTappedActivity({ activity, dayId });
  }

  async function openEditEditor(activity: TripActivity, dayId: string) {
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
        link: activity.booking_url ?? "",
        sync_to_gcal: !!activity.gcal_event_id,
      },
    });
  }

  function syncToCalendar(
    action: "create" | "update" | "delete",
    activityId: string,
    dayDate: string,
    dayId: string,
    gcalEventId?: string | null
  ) {
    fetch("/api/calendar/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        activity_id: activityId,
        day_date: dayDate,
        gcal_event_id: gcalEventId,
        timezone: timezone ?? "UTC",
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        // After a create, store the returned gcal_event_id in local state
        // so subsequent edits know to update instead of creating a new event
        if (action === "create" && data.gcal_event_id) {
          setDays((prev) =>
            prev.map((d) =>
              d.id === dayId
                ? {
                    ...d,
                    trip_activities: d.trip_activities.map((a) =>
                      a.id === activityId
                        ? { ...a, gcal_event_id: data.gcal_event_id }
                        : a
                    ),
                  }
                : d
            )
          );
        }
      })
      .catch(() => {});
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
          booking_url: form.link.trim() || null,
        };
        const { error } = await supabase
          .from("trip_activities")
          .update(updates)
          .eq("id", editorState.activity.id);

        if (!error) {
          const actId = editorState.activity.id;
          const dayId = editorState.dayId;
          const hadGcal = !!editorState.activity.gcal_event_id;
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
          if (form.start_time) {
            if (form.sync_to_gcal) {
              // Checked: create or update in Google Calendar
              syncToCalendar(
                hadGcal ? "update" : "create",
                actId,
                editorState.dayDate,
                editorState.dayId,
                editorState.activity.gcal_event_id
              );
            } else if (hadGcal) {
              // Unchecked but was previously synced: remove from Google Calendar
              syncToCalendar(
                "delete",
                actId,
                editorState.dayDate,
                editorState.dayId,
                editorState.activity.gcal_event_id
              );
            }
          }
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
          booking_url: form.link.trim() || null,
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
          if (form.sync_to_gcal && form.start_time) {
            syncToCalendar("create", data.id, editorState.dayDate, editorState.dayId);
          }
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
        if (editorState.activity.gcal_event_id) {
          syncToCalendar(
            "delete",
            actId,
            editorState.dayDate,
            editorState.dayId,
            editorState.activity.gcal_event_id
          );
        }
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

  async function handleActivityTimeUpdate(
    activityId: string,
    dayId: string,
    startTime: string,
    endTime: string
  ) {
    const day = days.find((d) => d.id === dayId);
    const activity = day?.trip_activities.find((a) => a.id === activityId);
    const updates = { start_time: startTime, end_time: endTime };

    const { error } = await supabase
      .from("trip_activities")
      .update(updates)
      .eq("id", activityId);

    if (!error) {
      setDays((prev) =>
        prev.map((d) =>
          d.id !== dayId
            ? d
            : {
                ...d,
                trip_activities: d.trip_activities.map((a) =>
                  a.id !== activityId ? a : { ...a, ...updates }
                ),
              }
        )
      );
      // Only sync on drag if the activity was already opted in to Google Calendar
      if (day && activity && activity.gcal_event_id) {
        syncToCalendar(
          "update",
          activityId,
          day.date,
          dayId,
          activity.gcal_event_id
        );
      }
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
      <div className="flex items-center gap-2 min-w-0">
        {/* Back link */}
        <Link
          href="/trips"
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors shrink-0"
        >
          ← Back
        </Link>

        {/* Legend — desktop only */}
        <div className="hidden sm:flex flex-wrap gap-x-4 gap-y-1.5 flex-1 ml-2">
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

        {/* Spacer on mobile */}
        <div className="flex-1 sm:hidden" />

        {/* Timezone picker */}
        <TimezoneSelector
          value={timezone}
          onChange={async (tz) => {
            setTimezone(tz);
            await supabase.from("trips").update({ timezone: tz }).eq("id", tripId);
          }}
        />

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-[var(--color-border)] overflow-hidden text-sm shrink-0">
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

      {/* Quick action sheet when tapping an activity with a location */}
      {tappedActivity && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setTappedActivity(null)}
        >
          <div
            className="bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl w-full sm:max-w-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-2">
              <h3 className="font-semibold text-sm truncate">
                {tappedActivity.activity.title}
              </h3>
              {tappedActivity.activity.start_time && (
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {formatDisplayTime(tappedActivity.activity.start_time)}
                  {tappedActivity.activity.end_time &&
                    ` – ${formatDisplayTime(tappedActivity.activity.end_time)}`}
                </p>
              )}
            </div>
            <div className="px-3 pb-3 space-y-1">
              <button
                onClick={() => {
                  window.open(tappedActivity.activity.booking_url!, "_blank");
                  setTappedActivity(null);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                    <circle cx="12" cy="9" r="2.5"/>
                  </svg>
                </div>
                <div>
                  <span className="text-sm font-medium">Open in Maps</span>
                  <p className="text-[11px] text-[var(--color-text-muted)] truncate max-w-[200px]">
                    {tappedActivity.activity.location || tappedActivity.activity.booking_url}
                  </p>
                </div>
              </button>
              <button
                onClick={() => {
                  const { activity, dayId } = tappedActivity;
                  setTappedActivity(null);
                  openEditEditor(activity, dayId);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Edit Activity</span>
              </button>
            </div>
            <button
              onClick={() => setTappedActivity(null)}
              className="w-full py-3 text-sm text-[var(--color-text-muted)] border-t border-gray-100 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
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
          onActivityEdit={handleActivityTap}
          onUpdateDayField={handleUpdateDayField}
          onActivityTimeUpdate={handleActivityTimeUpdate}
        />
      ) : (
        <ListView days={days} />
      )}
    </div>
  );
}
