"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Trip } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";

interface Props {
  initialTrips: Trip[];
}

type CreationMode = "ai" | "manual" | "csv";

export function TripsClient({ initialTrips }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [showForm, setShowForm] = useState(false);
  const [mode, setMode] = useState<CreationMode>("ai");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    destination: "",
    start_date: "",
    end_date: "",
    interests: "",
    budget: "",
    notes: "",
  });
  const [csvText, setCsvText] = useState("");

  function resetForm() {
    setForm({
      destination: "",
      start_date: "",
      end_date: "",
      interests: "",
      budget: "",
      notes: "",
    });
  }

  async function handleAIGenerate() {
    if (!form.destination || !form.start_date || !form.end_date) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/trips/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.trip) {
        setTrips((prev) => [data.trip, ...prev]);
        setShowForm(false);
        resetForm();
      }
    } catch (err) {
      console.error("Trip generation failed:", err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleManualCreate() {
    if (!form.destination || !form.start_date || !form.end_date) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/trips/create-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: form.destination,
          start_date: form.start_date,
          end_date: form.end_date,
          budget: form.budget || undefined,
          notes: form.notes || undefined,
        }),
      });
      const data = await res.json();
      if (data.trip) {
        // Navigate to the trip in edit mode
        router.push(`/trips/${data.trip.id}?edit=true`);
      }
    } catch (err) {
      console.error("Manual trip creation failed:", err);
      setSubmitting(false);
    }
  }

  async function handleCSVImport() {
    if (!csvText.trim()) return;
    setSubmitting(true);

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
        console.error("Import failed:", data.error);
        return;
      }
      if (data.trip) {
        router.push(`/trips/${data.trip.id}`);
      }
    } catch (err) {
      console.error("CSV import failed:", err);
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
    !!form.destination && !!form.start_date && !!form.end_date && !submitting;

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
            Plan your next adventure with AI or build your own itinerary.
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
                onClick={() => setMode("ai")}
                className={`px-4 py-2 flex items-center gap-1.5 transition-colors ${
                  mode === "ai"
                    ? "bg-[var(--color-brand-600)] text-white font-medium"
                    : "text-[var(--color-text-muted)] hover:bg-gray-50"
                }`}
              >
                <span>{Icons.sparkle}</span>
                Generate with AI
              </button>
              <button
                onClick={() => setMode("manual")}
                className={`px-4 py-2 flex items-center gap-1.5 transition-colors border-l border-[var(--color-border)] ${
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
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Start Date
                  </label>
                  <Input
                    type="date"
                    value={form.start_date}
                    onChange={(e) =>
                      setForm({ ...form, start_date: e.target.value })
                    }
                    className="h-10 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    End Date
                  </label>
                  <Input
                    type="date"
                    value={form.end_date}
                    onChange={(e) =>
                      setForm({ ...form, end_date: e.target.value })
                    }
                    className="h-10 text-sm"
                  />
                </div>

                {mode === "ai" && (
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium mb-1.5">
                      Interests{" "}
                      <span className="text-muted-foreground font-normal">
                        (optional)
                      </span>
                    </label>
                    <Input
                      placeholder="e.g. food, history, street art, beaches"
                      value={form.interests}
                      onChange={(e) =>
                        setForm({ ...form, interests: e.target.value })
                      }
                      className="h-10 text-sm"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1.5">
                    Budget{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </label>
                  <Input
                    placeholder="e.g. $2000"
                    value={form.budget}
                    onChange={(e) =>
                      setForm({ ...form, budget: e.target.value })
                    }
                    className="h-10 text-sm"
                  />
                </div>
                <div>
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

            <div className="mt-5 lg:mt-6">
              {mode === "ai" ? (
                <Button
                  onClick={handleAIGenerate}
                  disabled={!canSubmit}
                  className="w-full sm:w-auto rounded-full px-8 h-11 gap-2"
                >
                  <span>{Icons.sparkle}</span>
                  {submitting ? "Generating itinerary..." : "Generate Itinerary"}
                </Button>
              ) : mode === "csv" ? (
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
            <Link key={trip.id} href={`/trips/${trip.id}`}>
              <Card className="hover:ring-primary/30 hover:shadow-md transition-all cursor-pointer">
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center text-primary/70 flex-shrink-0 mt-0.5">
                        {Icons.map}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold truncate">{trip.title}</h3>
                        <p className="text-xs lg:text-sm text-muted-foreground mt-0.5 truncate">
                          {trip.destination} · {formatDate(trip.start_date)} –{" "}
                          {formatDate(trip.end_date)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">
                      {tripDuration(trip.start_date, trip.end_date)}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
