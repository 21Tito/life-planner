"use client";

import { createClient } from "@/lib/supabase/client";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Trip } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";

interface Props {
  initialTrips: Trip[];
}

type CreationMode = "manual" | "csv";

export function TripsClient({ initialTrips }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<CreationMode>("manual");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [form, setForm] = useState({
    destination: "",
    notes: "",
  });
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });
  const [csvText, setCsvText] = useState("");

  function toDateStr(d: Date): string {
    return d.toISOString().split("T")[0];
  }

  function resetForm() {
    setForm({ destination: "", notes: "" });
    setDateRange({ from: undefined, to: undefined });
  }

  async function handleManualCreate() {
    if (!form.destination || !dateRange.from || !dateRange.to) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/trips/create-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: form.destination,
          start_date: toDateStr(dateRange.from),
          end_date: toDateStr(dateRange.to),
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.trip) {
        // Navigate to the trip — keep submitting=true while navigating
        // so the button stays in loading state until the new page loads.
        router.push(`/trips/${data.trip.id}?edit=true`);
        return;
      }
      setSubmitError(data.error ?? "Failed to create trip");
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCSVImport() {
    if (!csvText.trim()) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/trips/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csv: csvText,
          title: form.destination ? `${form.destination} Trip` : undefined,
          destination: form.destination || undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSubmitError(data.error);
        return;
      }
      if (data.trip) {
        router.push(`/trips/${data.trip.id}`);
        return;
      }
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCsvText(ev.target?.result as string);
    };
    reader.readAsText(file);
  }

  async function handleDelete(tripId: string) {
    const { error } = await supabase.from("trips").delete().eq("id", tripId);
    if (!error) {
      setTrips((prev) => prev.filter((t) => t.id !== tripId));
    }
  }

  // ── Edit modal ──────────────────────────────────────────────────────────────

  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [deletingTrip, setDeletingTrip] = useState<Trip | null>(null);
  const [editForm, setEditForm] = useState({ destination: "", notes: "" });
  const [editDateRange, setEditDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({ from: undefined, to: undefined });
  const [editSaving, setEditSaving] = useState(false);

  function openEditModal(trip: Trip) {
    setEditingTrip(trip);
    setEditForm({ destination: trip.destination, notes: trip.notes ?? "" });
    setEditDateRange({
      from: new Date(trip.start_date + "T00:00:00"),
      to: new Date(trip.end_date + "T00:00:00"),
    });
  }

  async function handleEditSave() {
    if (!editingTrip || !editForm.destination || !editDateRange.from || !editDateRange.to) return;
    setEditSaving(true);
    const start_date = toDateStr(editDateRange.from);
    const end_date = toDateStr(editDateRange.to);
    try {
      const res = await fetch("/api/trips/update", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId: editingTrip.id,
          destination: editForm.destination.trim(),
          start_date,
          end_date,
          notes: editForm.notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setTrips((prev) =>
          prev.map((t) =>
            t.id === editingTrip.id
              ? {
                  ...t,
                  destination: editForm.destination.trim(),
                  title: `${editForm.destination.trim()} Trip`,
                  start_date,
                  end_date,
                  notes: editForm.notes.trim() || null,
                }
              : t
          )
        );
        setEditingTrip(null);
      }
    } finally {
      setEditSaving(false);
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function tripDuration(start: string, end: string) {
    const diff = new Date(end).getTime() - new Date(start).getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1;
    return `${days} day${days !== 1 ? "s" : ""}`;
  }

  const canSubmit =
    !!form.destination && !!dateRange.from && !!dateRange.to && !submitting;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 lg:mb-8 gap-4">
        <div>
          <h1
            className="text-2xl lg:text-3xl font-bold mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Trip Planner
          </h1>
          <p className="text-sm text-muted-foreground">
            Plan your next adventure with a day-by-day itinerary.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowForm(!showForm);
            if (!showForm) resetForm();
          }}
          className="rounded-full px-5 h-10 gap-2 flex-shrink-0"
        >
          {showForm ? (
            <>
              <span>{Icons.close}</span>
              <span className="hidden sm:inline">Cancel</span>
            </>
          ) : (
            <>
              <span>{Icons.plus}</span>
              <span>New Trip</span>
            </>
          )}
        </Button>
      </div>

      {/* Create Trip Form */}
      {showForm && (
        <Card className="mb-6 lg:mb-8">
          <CardContent className="pt-5 pb-5 lg:pt-6 lg:pb-6">
            <h2 className="text-base font-semibold mb-4">Plan a new trip</h2>

            {/* Mode toggle */}
            <div className="flex rounded-xl border border-[var(--color-border)] overflow-hidden mb-5 text-sm w-fit">
              <button
                onClick={() => setMode("manual")}
                className={`px-4 py-2 flex items-center gap-1.5 transition-colors ${
                  mode === "manual"
                    ? "bg-[var(--color-brand-600)] text-white font-medium"
                    : "text-[var(--color-text-muted)] hover:bg-gray-50"
                }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
                Build Manually
              </button>
              <button
                onClick={() => setMode("csv")}
                className={`px-4 py-2 flex items-center gap-1.5 transition-colors border-l border-[var(--color-border)] ${
                  mode === "csv"
                    ? "bg-[var(--color-brand-600)] text-white font-medium"
                    : "text-[var(--color-text-muted)] hover:bg-gray-50"
                }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                  <path d="M14 2v6h6" />
                  <path d="M12 18v-6" />
                  <path d="M9 15h6" />
                </svg>
                Import CSV
              </button>
            </div>

            {mode === "csv" ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Destination{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </label>
                  <Input
                    placeholder="e.g. Portugal"
                    value={form.destination}
                    onChange={(e) =>
                      setForm({ ...form, destination: e.target.value })
                    }
                    className="h-10 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Upload CSV file
                  </label>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="h-10 text-sm file:mr-3 file:px-3 file:py-1 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-secondary file:text-secondary-foreground hover:file:bg-secondary/80"
                  />
                </div>
                {csvText && (
                  <p className="text-xs text-green-600 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    CSV loaded ({csvText.split("\n").length} rows)
                  </p>
                )}
              </div>
            ) : (
              <div className="grid gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">
                    Destination
                  </label>
                  <Input
                    placeholder="e.g. Lisbon, Portugal"
                    value={form.destination}
                    onChange={(e) =>
                      setForm({ ...form, destination: e.target.value })
                    }
                    className="h-10 text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">
                    Dates
                  </label>
                  <DateRangePicker
                    value={dateRange}
                    onChange={setDateRange}
                    placeholder="Pick start & end date"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium mb-1.5">
                    Notes{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </label>
                  <Input
                    placeholder="e.g. traveling with partner"
                    value={form.notes}
                    onChange={(e) =>
                      setForm({ ...form, notes: e.target.value })
                    }
                    className="h-10 text-sm"
                  />
                </div>
              </div>
            )}

            {submitError && (
              <p className="mt-4 text-sm text-red-600 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                {submitError}
              </p>
            )}

            <div className="mt-5 lg:mt-6">
              {mode === "csv" ? (
                <Button
                  onClick={handleCSVImport}
                  disabled={!csvText.trim() || submitting}
                  className="w-full sm:w-auto rounded-full px-8 h-11 gap-2"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
                    <path d="M14 2v6h6" />
                  </svg>
                  {submitting ? "Importing..." : "Import & View Trip"}
                </Button>
              ) : (
                <Button
                  onClick={handleManualCreate}
                  disabled={!canSubmit}
                  className="w-full sm:w-auto rounded-full px-8 h-11 gap-2"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                  {submitting ? "Creating..." : "Create & Start Planning"}
                </Button>
              )}
            </div>

            {mode === "csv" && (
              <p className="text-xs text-[var(--color-text-muted)] mt-3">
                Upload a CSV exported from Google Sheets. Dates, cities, hotels,
                and timed activities will be imported automatically.
              </p>
            )}
            {mode === "manual" && (
              <p className="text-xs text-[var(--color-text-muted)] mt-3">
                You&apos;ll be taken to an empty calendar where you can add activities
                manually.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Trip List */}
      {trips.length === 0 && !showForm ? (
        <EmptyState
          icon={Icons.map}
          title="No trips planned yet"
          description='Hit "New Trip" to start planning your adventure.'
        />
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => (
            <div key={trip.id} className="relative group">
              <Link href={`/trips/${trip.id}`}>
                <Card className="hover:ring-primary/30 hover:shadow-md transition-all cursor-pointer">
                  <CardContent className="py-4 px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-primary/70 flex-shrink-0 mt-0.5">
                          {Icons.map}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="flex-shrink-0 text-xs">
                              {tripDuration(trip.start_date, trip.end_date)}
                            </Badge>
                            <h3 className="font-semibold truncate">{trip.title}</h3>
                          </div>
                          <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 truncate">
                            {trip.destination} · {formatDate(trip.start_date)} –{" "}
                            {formatDate(trip.end_date)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
              {/* Menu sits outside the Link/Card so its dropdown isn't clipped */}
              <div className="absolute right-2 top-1/2 -translate-y-1/2 z-10">
                <TripMenu
                  onEdit={() => openEditModal(trip)}
                  onDelete={() => setDeletingTrip(trip)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editingTrip && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={(e) => e.target === e.currentTarget && setEditingTrip(null)}
        >
          <div className="bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl w-full sm:max-w-md flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-base">Edit Trip</h2>
              <button
                onClick={() => setEditingTrip(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100"
              >
                ✕
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5">Destination</label>
                <Input
                  placeholder="e.g. Lisbon, Portugal"
                  value={editForm.destination}
                  onChange={(e) => setEditForm({ ...editForm, destination: e.target.value })}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Dates</label>
                <DateRangePicker
                  value={editDateRange}
                  onChange={setEditDateRange}
                  placeholder="Pick start & end date"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. traveling with partner"
                  value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button
                onClick={() => setEditingTrip(null)}
                className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                disabled={editSaving || !editForm.destination || !editDateRange.from || !editDateRange.to}
                className="px-4 py-2 text-sm rounded-lg bg-[var(--color-brand-600)] text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {editSaving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Delete confirmation modal */}
      {deletingTrip && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={(e) => e.target === e.currentTarget && setDeletingTrip(null)}
        >
          <div className="bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl w-full sm:max-w-sm flex flex-col">
            <div className="px-5 py-5">
              <h2 className="font-semibold text-base mb-1">Delete trip?</h2>
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{deletingTrip.title}</span> and all its activities will be permanently deleted. This cannot be undone.
              </p>
            </div>
            <div className="flex gap-2 px-5 pb-5">
              <button
                onClick={() => setDeletingTrip(null)}
                className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => { handleDelete(deletingTrip.id); setDeletingTrip(null); }}
                className="flex-1 px-4 py-2.5 text-sm rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Trip action menu (⋯) ──────────────────────────────────────────────────────

function TripMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o); }}
        className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="More options"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="12" cy="19" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white rounded-xl shadow-lg border border-border py-1 w-36">
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
            Edit details
          </button>
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
