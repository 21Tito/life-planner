"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useOwnerId } from "@/lib/household-context";
import type { TripDay, TripActivity, ActivityCategory, TripHotel } from "@/types";
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
const START_HOUR = 7;
const END_HOUR = 24;
const TIME_COL_WIDTH = 52;
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;

// +1 to include midnight label at the very bottom
const hours = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i
);

// Time select options: 1 AM to 12 AM (midnight) in 15-minute increments
const TIME_OPTIONS = Array.from({ length: 93 }, (_, i) => {
  const totalMinutes = 60 + i * 15; // start at 01:00, step 15 min, end at midnight
  const hour = Math.floor(totalMinutes / 60) % 24;
  const minute = totalMinutes % 60;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 || hour === 0 ? "AM" : "PM";
  const label = `${displayHour}:${String(minute).padStart(2, "0")} ${ampm}`;
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
  date: string; // YYYY-MM-DD
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

function linkifyText(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">
        {part}
      </a>
    ) : (
      part
    )
  );
}

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
  targetDayId: string;
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
    date: "",
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
  tripDates,
}: {
  editorState: EditorState;
  saving: boolean;
  onClose: () => void;
  onSave: (form: ActivityFormData) => void;
  onDelete: () => void;
  tripDates: string[];
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

          {/* Date */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Date</label>
            <select
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-base bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
            >
              {tripDates.map((d) => (
                <option key={d} value={d}>
                  {new Date(d + "T00:00:00").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </option>
              ))}
            </select>
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
                    className={`rounded-lg border ${config.border} ${config.bg} p-4 ${activity.done ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${activity.done ? "bg-gray-400" : config.dot}`}
                        />
                        <div>
                          <h3 className={`font-medium text-sm ${config.text} ${activity.done ? "line-through" : ""}`}>
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateRange(start: string, end: string) {
  const fmt = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  return start === end ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
}

function CityPill({
  city,
  dateRange,
  onSave,
}: {
  city: string;
  dateRange: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(city);

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => {
          onSave(value);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(value); setEditing(false); }
          if (e.key === "Escape") { setValue(city); setEditing(false); }
        }}
        className="px-2.5 py-1 text-xs rounded-full border border-[var(--color-brand-600)] outline-none text-[var(--color-brand-700)] bg-[var(--color-brand-50)]"
        style={{ width: Math.max(value.length * 8 + 16, 72) }}
      />
    );
  }

  return (
    <button
      onClick={() => { setValue(city); setEditing(true); }}
      className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-brand-50)] border border-[var(--color-brand-200)] rounded-full text-xs text-[var(--color-brand-700)] hover:bg-[var(--color-brand-100)] transition-colors"
    >
      <span className="font-medium">{city}</span>
      <span className="text-[10px] text-[var(--color-brand-400)]">{dateRange}</span>
    </button>
  );
}

// ─── Calendar grid ────────────────────────────────────────────────────────────

function CalendarGrid({
  days,
  hotels,
  onCellClick,
  onActivityEdit,
  onActivityTimeUpdate,
  onActivityDayUpdate,
  onUpdateDayField,
  onHotelClick,
  onAddHotel,
}: {
  days: DayWithActivities[];
  hotels: TripHotel[];
  onCellClick?: (dayId: string, dayDate: string, startHour: number, endHour: number) => void;
  onActivityEdit?: (activity: TripActivity, dayId: string) => void;
  onActivityTimeUpdate?: (activityId: string, dayId: string, startTime: string, endTime: string) => void;
  onActivityDayUpdate?: (activityId: string, fromDayId: string, toDayId: string, startTime: string, endTime: string) => void;
  onUpdateDayField?: (dayId: string, field: "title" | "notes", value: string) => void;
  onHotelClick?: (hotel: TripHotel) => void;
  onAddHotel?: () => void;
}) {
  // Drag-to-select (create) state
  const [dragState, setDragState] = useState<{
    dayId: string;
    dayDate: string;
    startHour: number;
    currentHour: number;
  } | null>(null);

  // Scroll to current time (centered) on mount; keep time column in sync
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const timeColRef = useRef<HTMLDivElement>(null);
  const cityGridRef = useRef<HTMLDivElement>(null);
  const hotelGridRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollContainerRef.current) {
      const nowDate = new Date();
      const currentHourDecimal = nowDate.getHours() + nowDate.getMinutes() / 60;
      const currentTimeTop = (currentHourDecimal - START_HOUR) * HOUR_HEIGHT;
      const containerHeight = scrollContainerRef.current.clientHeight;
      const scrollTop = Math.max(0, currentTimeTop - containerHeight / 2);
      scrollContainerRef.current.scrollTop = scrollTop;
      if (timeColRef.current) timeColRef.current.scrollTop = scrollTop;
    }
  }, []);

  // Keep city/hotel grid widths in sync with the inner scroll container's content width
  // (accounts for the vertical scrollbar width on desktop)
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const syncScrollbarGap = () => {
      const w = el.offsetWidth - el.clientWidth;
      if (cityGridRef.current) cityGridRef.current.style.paddingRight = `${w}px`;
      if (hotelGridRef.current) hotelGridRef.current.style.paddingRight = `${w}px`;
    };
    syncScrollbarGap();
    const ro = new ResizeObserver(syncScrollbarGap);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Current time indicator — updates every minute
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
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
      // Detect which day column the cursor is over
      if (actDragRef.current?.type === "move") {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const col = el?.closest("[data-day-id]");
        const hoveredDayId = col?.getAttribute("data-day-id");
        if (hoveredDayId) {
          setActDrag((prev) =>
            prev && prev.targetDayId !== hoveredDayId
              ? { ...prev, targetDayId: hoveredDayId }
              : prev
          );
        }
      }
    }

    function onUp() {
      const drag = actDragRef.current;
      if (!drag) return;
      if (dragMovedRef.current) {
        if (drag.targetDayId !== drag.dayId) {
          onActivityDayUpdate?.(
            drag.activityId,
            drag.dayId,
            drag.targetDayId,
            minutesToTime(drag.startMinutes),
            minutesToTime(drag.endMinutes)
          );
        } else {
          onActivityTimeUpdate?.(
            drag.activityId,
            drag.dayId,
            minutesToTime(drag.startMinutes),
            minutesToTime(drag.endMinutes)
          );
        }
      }
      // No-drag tap case is handled by the native listener in startActivityMove.
      setActDrag(null);
      dragMovedRef.current = false;
    }

    function onTouchMove(e: TouchEvent) {
      if (!isTouchDraggingRef.current) return;
      e.preventDefault(); // block scroll while dragging
      const touch = e.touches[0];
      updateDragFromClientY(touch.clientY);
      // Detect target day column
      if (actDragRef.current?.type === "move") {
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        const col = el?.closest("[data-day-id]");
        const hoveredDayId = col?.getAttribute("data-day-id");
        if (hoveredDayId) {
          setActDrag((prev) =>
            prev && prev.targetDayId !== hoveredDayId
              ? { ...prev, targetDayId: hoveredDayId }
              : prev
          );
        }
      }
    }

    function onTouchEnd() {
      if (!isTouchDraggingRef.current) return;
      const drag = actDragRef.current;
      if (drag) {
        if (drag.targetDayId !== drag.dayId) {
          onActivityDayUpdate?.(
            drag.activityId,
            drag.dayId,
            drag.targetDayId,
            minutesToTime(drag.startMinutes),
            minutesToTime(drag.endMinutes)
          );
        } else {
          onActivityTimeUpdate?.(
            drag.activityId,
            drag.dayId,
            minutesToTime(drag.startMinutes),
            minutesToTime(drag.endMinutes)
          );
        }
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

    // Register a native mouseup listener immediately so a quick tap is caught
    // even before React re-renders and adds the drag-system's onUp listener.
    const onTapUp = () => {
      window.removeEventListener("mouseup", onTapUp);
      if (!dragMovedRef.current) {
        onActivityEdit?.(activity, dayId);
      }
    };
    window.addEventListener("mouseup", onTapUp);

    setActDrag({
      type: "move",
      activityId: activity.id,
      activity,
      dayId,
      targetDayId: dayId,
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
      targetDayId: dayId,
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
        targetDayId: info.dayId,
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
    if (!isTouchDraggingRef.current) {
      cancelTouchLongPress();
      // Quick tap (no long-press drag) → open quick actions
      const info = touchDragStartRef.current;
      if (info) {
        touchDragStartRef.current = null;
        onActivityEdit?.(info.activity, info.dayId);
      }
    }
  }

  // ── City spans (consecutive same-city days merged) ──
  const pageCitySpans: { city: string | null; span: number; startIdx: number; dayIds: string[] }[] = [];
  for (let i = 0; i < days.length; i++) {
    const city = days[i].title ?? null;
    const last = pageCitySpans[pageCitySpans.length - 1];
    // Only merge consecutive days that share the same non-null city
    if (city !== null && last && last.city === city) {
      last.span += 1;
      last.dayIds.push(days[i].id);
    } else {
      pageCitySpans.push({ city, span: 1, startIdx: i, dayIds: [days[i].id] });
    }
  }

  // ── Hotel spans (intersect hotel date range with visible days) ──
  const pageHotelSpans: { hotel: TripHotel; startIdx: number; span: number }[] = [];
  for (const hotel of hotels) {
    let startIdx = -1, endIdx = -1;
    for (let i = 0; i < days.length; i++) {
      const d = days[i].date;
      if (d >= hotel.check_in_date && d <= hotel.check_out_date) {
        if (startIdx === -1) startIdx = i;
        endIdx = i;
      }
    }
    if (startIdx !== -1) pageHotelSpans.push({ hotel, startIdx, span: endIdx - startIdx + 1 });
  }
  // Build set of column indices covered by a hotel
  const hotelCoveredCols = new Set<number>();
  pageHotelSpans.forEach(({ startIdx, span }) => {
    for (let i = startIdx; i < startIdx + span; i++) hotelCoveredCols.add(i);
  });

  const gridCols = `${TIME_COL_WIDTH}px repeat(${days.length}, minmax(100px, 1fr))`;

  return (
    <div
      className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-white w-full min-w-0"
    >
    <div style={{ minWidth: days.length * 100 + TIME_COL_WIDTH }}>

      {/* ══ CITY ROW ══ */}
      <div className="flex border-b border-[var(--color-border)] bg-white" style={{ height: 34 }}>
        <div
          className="sticky left-0 z-10 bg-white border-r border-[var(--color-border)] flex-shrink-0 flex items-center justify-end pr-2"
          style={{ width: TIME_COL_WIDTH }}
        >
          <span className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">City</span>
        </div>
        <div ref={cityGridRef} className="grid flex-1" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(100px, 1fr))`, boxSizing: "border-box" }}>
          {pageCitySpans.map((group, idx) => (
            <div
              key={idx}
              className="border-r border-[var(--color-border)] last:border-r-0"
              style={{ gridColumn: `${group.startIdx + 1} / span ${group.span}` }}
            >
              <InlineEditCell
                value={group.city}
                placeholder="Add city…"
                onSave={(v) => group.dayIds.forEach((id) => onUpdateDayField?.(id, "title", v))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ══ HOTEL ROW ══ */}
      <div className="flex border-b border-[var(--color-border)]" style={{ backgroundColor: "rgb(255 247 237 / 0.6)", height: 36 }}>
        <div
          className="sticky left-0 z-10 border-r border-[var(--color-border)] flex-shrink-0 flex items-center justify-end pr-2"
          style={{ width: TIME_COL_WIDTH, backgroundColor: "rgb(255 247 237 / 0.6)" }}
        >
          <span className="text-[9px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Hotel</span>
        </div>
        <div ref={hotelGridRef} className="grid flex-1 relative" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(100px, 1fr))`, boxSizing: "border-box" }}>
          {/* Hotel spans */}
          {pageHotelSpans.map(({ hotel, startIdx, span }) => (
            <div
              key={hotel.id}
              className="flex items-center justify-center px-2 gap-1.5 bg-orange-100 border-r border-[var(--color-border)] overflow-hidden"
              style={{ gridColumn: `${startIdx + 1} / span ${span}` }}
            >
              <button
                onClick={() => onHotelClick?.(hotel)}
                className="flex items-center gap-1.5 min-w-0 hover:opacity-70 transition-opacity"
                title={hotel.name}
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500 shrink-0">
                  <path d="M3 22V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v15" /><path d="M6 22v-4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" /><rect width="4" height="4" x="10" y="11" />
                </svg>
                <span className="text-xs font-medium text-orange-800 truncate">{hotel.name}</span>
              </button>
              {hotel.maps_url && (
                <a
                  href={hotel.maps_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 text-orange-400 hover:text-orange-600 transition-colors"
                  title="Open in Maps"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
                  </svg>
                </a>
              )}
            </div>
          ))}
          {/* Empty cells for uncovered columns */}
          {(() => {
            const empties: React.ReactNode[] = [];
            let i = 0;
            while (i < days.length) {
              if (!hotelCoveredCols.has(i)) {
                const start = i;
                let span = 0;
                while (i < days.length && !hotelCoveredCols.has(i)) { span++; i++; }
                empties.push(
                  <button
                    key={`empty-${start}`}
                    onClick={onAddHotel}
                    className="flex items-center justify-center border-r border-[var(--color-border)] last:border-r-0 text-[10px] text-orange-300 hover:text-orange-500 hover:bg-orange-50 transition-colors"
                    style={{ gridColumn: `${start + 1} / span ${span}` }}
                  >
                    + hotel
                  </button>
                );
              } else {
                i++;
              }
            }
            return empties;
          })()}
        </div>
      </div>

      {/* ══ TIME COLUMN (sticky left) + SCROLLABLE BODY ══ */}
      <div className="flex">

        {/* Time column — sticky left, scrollTop synced via JS */}
        <div
          ref={timeColRef}
          className="sticky left-0 z-10 bg-white border-r border-[var(--color-border)] flex-shrink-0"
          style={{ width: TIME_COL_WIDTH, overflowY: "hidden", height: "calc(78vh - 70px)" }}
        >
          {/* Spacer matching the date header height */}
          <div className="bg-gray-50 border-b border-[var(--color-border)]" style={{ height: 38 }} />
          {/* Time labels */}
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

        {/* Scrollable area — date header sticks, day columns scroll */}
        <div
          ref={scrollContainerRef}
          className="overflow-y-auto flex-1"
          style={{ maxHeight: "calc(78vh - 70px)" }}
          onScroll={(e) => {
            if (timeColRef.current) timeColRef.current.scrollTop = e.currentTarget.scrollTop;
          }}
        >
        <div className="flex flex-col min-w-0">
          {/* ══ STICKY DATE ROW ══ */}
          <div className="sticky top-0 z-20 bg-gray-50 border-b border-[var(--color-border)]" style={{ height: 38, display: "grid", gridTemplateColumns: `repeat(${days.length}, minmax(100px, 1fr))` }}>
            {days.map((day) => {
              const d = new Date(day.date + "T00:00:00");
              return (
                <div
                  key={day.id}
                  className="border-r border-[var(--color-border)] last:border-r-0"
                >
                  <div className="flex flex-col items-center justify-center py-2 gap-0.5">
                    <span className="text-[9px] font-semibold uppercase tracking-widest text-[var(--color-text-muted)]">
                      {d.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span className="text-[11px] font-bold text-[var(--color-brand-600)] leading-none">
                      {d.getMonth() + 1}/{d.getDate()}/{String(d.getFullYear()).slice(-2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ══ SCROLLABLE BODY ══ */}
          {/* Day columns (time grids) */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${days.length}, minmax(100px, 1fr))` }}>
            {days.map((day) => {
              const activities = day.trip_activities ?? [];
              return (
                <div
                  key={day.id}
                  className="border-r border-[var(--color-border)] last:border-r-0"
                >

                  {/* Time grid */}
                  <div
                    data-day-id={day.id}
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
                    {/* Past day overlay */}
                    {day.date < `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}` && (
                      <div className="absolute inset-0 pointer-events-none z-10 bg-white/50" />
                    )}
                    {/* Current time indicator + past overlay */}
                    {(() => {
                      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
                      if (day.date !== todayStr) return null;
                      const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
                      const topPx = (minutesSinceMidnight / 60 - START_HOUR) * HOUR_HEIGHT;
                      if (topPx < 0 || topPx > TOTAL_HEIGHT) return null;
                      return (
                        <>
                          {/* Past overlay */}
                          <div
                            className="absolute left-0 right-0 top-0 pointer-events-none z-10 bg-white/50"
                            style={{ height: topPx }}
                          />
                          {/* Current time line */}
                          <div
                            className="absolute left-0 right-0 pointer-events-none z-20"
                            style={{ top: topPx }}
                          >
                            <div className="relative flex items-center">
                              <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                              <div className="flex-1 border-t-2 border-red-500" />
                            </div>
                          </div>
                        </>
                      );
                    })()}
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
                      const isCrossDayDrag = isDragging && actDrag!.targetDayId !== actDrag!.dayId;
                      const basePos = getActivityPosition(activity);
                      if (!basePos && !isDragging) return null;

                      const config = getCategoryConfig(activity.category);

                      // Cross-day drag: show a ghost placeholder in the source day
                      if (isCrossDayDrag) {
                        const ghostTop = basePos ? basePos.top + 2 : 0;
                        const ghostHeight = basePos ? Math.max(basePos.height - 4, 20) : 40;
                        return (
                          <div
                            key={activity.id}
                            className={`absolute inset-x-1 rounded-lg border-2 border-dashed pointer-events-none z-0 ${config.border} opacity-30`}
                            style={{ top: ghostTop, height: ghostHeight }}
                          />
                        );
                      }

                      const displayStartMins = isDragging ? actDrag!.startMinutes : (activity.start_time ? timeToMinutes(activity.start_time) : START_HOUR * 60);
                      const displayEndMins = isDragging ? actDrag!.endMinutes : (activity.end_time ? timeToMinutes(activity.end_time) : displayStartMins + 60);
                      const displayTop = (displayStartMins / 60 - START_HOUR) * HOUR_HEIGHT + 2;
                      const displayHeight = Math.max(((displayEndMins - displayStartMins) / 60) * HOUR_HEIGHT - 4, 20);

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
                          } ${config.bg} ${config.border} ${config.text} transition-transform ${activity.done ? "opacity-40" : ""}`}
                          style={{ top: displayTop, height: displayHeight }}
                        >
                          <div className="p-1.5 h-full flex flex-col overflow-hidden pointer-events-none">
                            <div className="flex items-start gap-1 leading-tight">
                              {activity.done && (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-[1px]">
                                  <path d="M20 6 9 17l-5-5" />
                                </svg>
                              )}
                              <span className={`text-[11px] font-semibold line-clamp-2 ${activity.done ? "line-through opacity-60" : ""}`}>
                                {activity.title}
                              </span>
                            </div>
                            {activity.description && displayHeight >= 48 && !isDragging && (
                              <span className="text-[9px] leading-snug opacity-70 mt-0.5">
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

                    {/* Floating card in target day during cross-day drag */}
                    {actDrag?.targetDayId === day.id && actDrag.dayId !== day.id && (() => {
                      const config = getCategoryConfig(actDrag.activity.category);
                      const displayTop = (actDrag.startMinutes / 60 - START_HOUR) * HOUR_HEIGHT + 2;
                      const displayHeight = Math.max(((actDrag.endMinutes - actDrag.startMinutes) / 60) * HOUR_HEIGHT - 4, 20);
                      return (
                        <div
                          className={`absolute inset-x-1 rounded-lg border pointer-events-none shadow-xl z-30 opacity-90 scale-[1.02] ${config.bg} ${config.border} ${config.text}`}
                          style={{ top: displayTop, height: displayHeight }}
                        >
                          <div className="p-1.5 h-full flex flex-col overflow-hidden">
                            <span className="text-[11px] font-semibold line-clamp-2">{actDrag.activity.title}</span>
                            {displayHeight >= 36 && (
                              <span className="text-[9px] opacity-60 mt-auto shrink-0">
                                {`${formatMinutes(actDrag.startMinutes)} – ${formatMinutes(actDrag.endMinutes)}`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
      </div>{/* end flex-col min-w-0 */}
      </div>{/* end overflow-y-auto scroll area */}
      </div>{/* end time-col + scroll flex row */}
    </div>{/* end minWidth wrapper */}
    </div>
  );
}

// ─── Hotel Modal ──────────────────────────────────────────────────────────────

type HotelFormData = {
  name: string;
  location: string;
  maps_url: string;
  check_in_date: string;
  check_out_date: string;
  notes: string;
};

function HotelModal({
  hotel,
  prefillDate,
  tripDates,
  saving,
  onClose,
  onSave,
  onDelete,
}: {
  hotel: TripHotel | null;
  prefillDate?: string;
  tripDates: string[];
  saving: boolean;
  onClose: () => void;
  onSave: (form: HotelFormData) => void;
  onDelete: () => void;
}) {
  const isEditing = !!hotel;
  const defaultDate = prefillDate ?? tripDates[0] ?? "";
  const [form, setForm] = useState<HotelFormData>({
    name: hotel?.name ?? "",
    location: hotel?.location ?? "",
    maps_url: hotel?.maps_url ?? "",
    check_in_date: hotel?.check_in_date ?? defaultDate,
    check_out_date: hotel?.check_out_date ?? defaultDate,
    notes: hotel?.notes ?? "",
  });

  const dateLabel = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("en-US", {
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
          <h2 className="font-semibold text-base">
            {isEditing ? "Edit Hotel" : "Add Hotel"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Hotel name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Bairro Alto Hotel"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Location <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <PlacesInput
              value={form.location}
              onChange={(location, mapsUrl) => {
                setForm((f) => ({
                  ...f,
                  location,
                  maps_url: mapsUrl !== undefined ? (mapsUrl ?? "") : location ? f.maps_url : "",
                }));
              }}
              placeholder="Search for hotel address…"
              className="w-full h-10 px-3 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1.5">Check-in</label>
              <select
                value={form.check_in_date}
                onChange={(e) => {
                  const newIn = e.target.value;
                  setForm((f) => ({
                    ...f,
                    check_in_date: newIn,
                    // If check-out is before new check-in, move it forward
                    check_out_date: f.check_out_date < newIn ? newIn : f.check_out_date,
                  }));
                }}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
              >
                {tripDates.map((d) => (
                  <option key={d} value={d}>{dateLabel(d)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Check-out</label>
              <select
                value={form.check_out_date}
                onChange={(e) => setForm({ ...form, check_out_date: e.target.value })}
                className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
              >
                {tripDates.filter((d) => d >= form.check_in_date).map((d) => (
                  <option key={d} value={d}>{dateLabel(d)}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Confirmation number, room type…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-base resize-none focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-600)]/30 focus:border-[var(--color-brand-600)]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 gap-3 flex-shrink-0">
          {isEditing ? (
            <button
              onClick={onDelete}
              disabled={saving}
              className="text-sm text-red-500 hover:text-red-700 transition-colors disabled:opacity-40"
            >
              Delete hotel
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
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-[var(--color-brand-600)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {saving ? "Saving…" : isEditing ? "Save changes" : "Add hotel"}
            </button>
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
  initialHotels,
  tripStartDate,
  tripEndDate,
}: {
  days: DayWithActivities[];
  tripId: string;
  initialTimezone: string | null;
  initialHotels: TripHotel[];
  tripStartDate: string;
  tripEndDate: string;
}) {
  const supabase = createClient();
  const userId = useOwnerId();

  const [days, setDays] = useState<DayWithActivities[]>(initialDays);
  // null = never set; non-null = explicitly chosen (including "UTC")
  const [timezone, setTimezone] = useState<string | null>(initialTimezone);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [editorState, setEditorState] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const MOBILE_PAGE_SIZE = 5;
  const [page, setPage] = useState(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    const todayIdx = initialDays.findIndex((d) => d.date === todayStr);
    return todayIdx >= 0 ? Math.floor(todayIdx / MOBILE_PAGE_SIZE) : 0;
  });
  const [tappedActivity, setTappedActivity] = useState<{
    activity: TripActivity;
    dayId: string;
  } | null>(null);

  // ── Hotels ──
  const [hotels, setHotels] = useState<TripHotel[]>(initialHotels);
  const [hotelModal, setHotelModal] = useState<{
    open: boolean;
    hotel: TripHotel | null;
    prefillDate?: string;
  }>({ open: false, hotel: null });
  const [hotelSaving, setHotelSaving] = useState(false);
  const [tappedHotel, setTappedHotel] = useState<TripHotel | null>(null);

  // All trip dates as "YYYY-MM-DD" strings for dropdowns
  const tripDates: string[] = (() => {
    const dates: string[] = [];
    const cur = new Date(tripStartDate + "T00:00:00");
    const end = new Date(tripEndDate + "T00:00:00");
    while (cur <= end) {
      dates.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return dates;
  })();

  async function handleHotelSave(form: HotelFormData) {
    setHotelSaving(true);
    try {
      if (hotelModal.hotel) {
        // Update
        const res = await fetch("/api/trips/hotels/update", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hotelId: hotelModal.hotel.id, ...form }),
        });
        if ((await res.json()).ok) {
          setHotels((prev) =>
            prev.map((h) =>
              h.id === hotelModal.hotel!.id ? { ...h, ...form } : h
            )
          );
          setHotelModal({ open: false, hotel: null });
        }
      } else {
        // Create
        const res = await fetch("/api/trips/hotels/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tripId, ...form }),
        });
        const data = await res.json();
        if (data.hotel) {
          setHotels((prev) =>
            [...prev, data.hotel].sort((a, b) =>
              a.check_in_date.localeCompare(b.check_in_date)
            )
          );
          setHotelModal({ open: false, hotel: null });
        }
      }
    } finally {
      setHotelSaving(false);
    }
  }

  async function handleHotelDelete() {
    if (!hotelModal.hotel) return;
    setHotelSaving(true);
    try {
      const res = await fetch("/api/trips/hotels/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hotelId: hotelModal.hotel.id }),
      });
      if ((await res.json()).ok) {
        setHotels((prev) => prev.filter((h) => h.id !== hotelModal.hotel!.id));
        setHotelModal({ open: false, hotel: null });
      }
    } finally {
      setHotelSaving(false);
    }
  }

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
        date: dayDate,
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
    if (activity.start_time) {
      setTappedActivity({ activity, dayId });
    } else {
      openEditEditor(activity, dayId);
    }
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
        start_time: activity.start_time
          ? activity.start_time.slice(0, 5)
          : `${String(START_HOUR).padStart(2, "0")}:00`,
        end_time: activity.end_time
          ? activity.end_time.slice(0, 5)
          : `${String(START_HOUR + 1).padStart(2, "0")}:00`,
        date: day?.date ?? "",
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

  async function handleToggleDone(activityId: string, dayId: string, currentDone: boolean) {
    const newDone = !currentDone;
    // Optimistic update
    setDays((prev) =>
      prev.map((d) =>
        d.id === dayId
          ? {
              ...d,
              trip_activities: d.trip_activities.map((a) =>
                a.id === activityId ? { ...a, done: newDone } : a
              ),
            }
          : d
      )
    );
    await supabase.from("trip_activities").update({ done: newDone }).eq("id", activityId);
  }

  async function handleSave(form: ActivityFormData) {
    if (!editorState || !userId) return;
    setSaving(true);

    try {
      if (editorState.activity) {
        // Update existing activity
        const dateChanged = form.date && form.date !== editorState.dayDate;
        const newDay = dateChanged ? days.find((d) => d.date === form.date) : null;

        const updates: Record<string, unknown> = {
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
        if (newDay) updates.trip_day_id = newDay.id;

        const { error } = await supabase
          .from("trip_activities")
          .update(updates)
          .eq("id", editorState.activity.id);

        if (!error) {
          const actId = editorState.activity.id;
          const oldDayId = editorState.dayId;
          const hadGcal = !!editorState.activity.gcal_event_id;

          if (newDay) {
            // Move activity from old day to new day in local state
            setDays((prev) => {
              const act = prev
                .find((d) => d.id === oldDayId)
                ?.trip_activities.find((a) => a.id === actId);
              return prev.map((d) => {
                if (d.id === oldDayId)
                  return { ...d, trip_activities: d.trip_activities.filter((a) => a.id !== actId) };
                if (d.id === newDay.id)
                  return { ...d, trip_activities: [...d.trip_activities, { ...act!, ...updates, trip_day_id: newDay.id }] };
                return d;
              });
            });
          } else {
            setDays((prev) =>
              prev.map((d) =>
                d.id === oldDayId
                  ? {
                      ...d,
                      trip_activities: d.trip_activities.map((a) =>
                        a.id === actId ? { ...a, ...updates } : a
                      ),
                    }
                  : d
              )
            );
          }

          const effectiveDayId = newDay?.id ?? oldDayId;
          const effectiveDayDate = newDay?.date ?? editorState.dayDate;
          if (form.start_time) {
            if (form.sync_to_gcal) {
              syncToCalendar(
                hadGcal ? "update" : "create",
                actId,
                effectiveDayDate,
                effectiveDayId,
                editorState.activity.gcal_event_id
              );
            } else if (hadGcal) {
              syncToCalendar(
                "delete",
                actId,
                effectiveDayDate,
                effectiveDayId,
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

  async function handleActivityDayUpdate(
    activityId: string,
    fromDayId: string,
    toDayId: string,
    startTime: string,
    endTime: string
  ) {
    const fromDay = days.find((d) => d.id === fromDayId);
    const activity = fromDay?.trip_activities.find((a) => a.id === activityId);
    if (!activity) return;

    const updates = { trip_day_id: toDayId, start_time: startTime, end_time: endTime };
    const { error } = await supabase
      .from("trip_activities")
      .update(updates)
      .eq("id", activityId);

    if (!error) {
      setDays((prev) =>
        prev.map((d) => {
          if (d.id === fromDayId)
            return { ...d, trip_activities: d.trip_activities.filter((a) => a.id !== activityId) };
          if (d.id === toDayId)
            return { ...d, trip_activities: [...d.trip_activities, { ...activity, ...updates }] };
          return d;
        })
      );
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
          tripDates={tripDates}
        />
      )}

      {/* Quick action sheet when tapping an activity */}
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
            {/* Header */}
            <div className="px-5 pt-4 pb-3">
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

            {/* Actions */}
            <div className="px-3 space-y-1">
              {/* Open in Maps */}
              {(tappedActivity.activity.location || tappedActivity.activity.booking_url) && (
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
              )}

              {/* Notes */}
              {tappedActivity.activity.description && (
                <div className="px-3 py-3">
                  <p className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-1">Notes</p>
                  <p className="text-sm text-foreground leading-snug break-words">
                    {linkifyText(tappedActivity.activity.description)}
                  </p>
                </div>
              )}

              {/* Edit Activity */}
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

            {/* Mark as done — separated, smaller, harder to misclick */}
            <div className="mx-4 my-3 border-t border-gray-100 pt-3">
              <button
                onClick={() => {
                  const { activity, dayId } = tappedActivity;
                  handleToggleDone(activity.id, dayId, activity.done);
                  setTappedActivity(null);
                }}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors text-left"
              >
                <span className="text-xs text-[var(--color-text-muted)]">
                  {tappedActivity.activity.done ? "Marked as done" : "Mark as done"}
                </span>
                <div className={`w-4 h-4 rounded flex items-center justify-center border ${tappedActivity.activity.done ? "bg-green-500 border-green-500" : "border-gray-300 bg-white"}`}>
                  {tappedActivity.activity.done && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </div>
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

      {/* Hotel quick-action sheet */}
      {tappedHotel && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          onClick={() => setTappedHotel(null)}
        >
          <div
            className="bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl w-full sm:max-w-xs overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-2">
              <h3 className="font-semibold text-sm truncate">{tappedHotel.name}</h3>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {new Date(tappedHotel.check_in_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                {" – "}
                {new Date(tappedHotel.check_out_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
            </div>
            <div className="px-3 pb-3 space-y-1">
              {tappedHotel.maps_url && (
                <button
                  onClick={() => {
                    window.open(tappedHotel.maps_url!, "_blank");
                    setTappedHotel(null);
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
                      {tappedHotel.location || tappedHotel.maps_url}
                    </p>
                  </div>
                </button>
              )}
              <button
                onClick={() => {
                  setTappedHotel(null);
                  setHotelModal({ open: true, hotel: tappedHotel });
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Edit Hotel</span>
              </button>
            </div>
            <button
              onClick={() => setTappedHotel(null)}
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
          hotels={hotels}
          onCellClick={openAddEditor}
          onActivityEdit={handleActivityTap}
          onActivityTimeUpdate={handleActivityTimeUpdate}
          onActivityDayUpdate={handleActivityDayUpdate}
          onUpdateDayField={handleUpdateDayField}
          onHotelClick={(hotel) => setTappedHotel(hotel)}
          onAddHotel={() => setHotelModal({ open: true, hotel: null })}
        />
      ) : (
        <ListView days={days} />
      )}

      {/* Hotel modal */}
      {hotelModal.open && (
        <HotelModal
          hotel={hotelModal.hotel}
          prefillDate={hotelModal.prefillDate}
          tripDates={tripDates}
          saving={hotelSaving}
          onClose={() => setHotelModal({ open: false, hotel: null })}
          onSave={handleHotelSave}
          onDelete={handleHotelDelete}
        />
      )}
    </div>
  );
}
