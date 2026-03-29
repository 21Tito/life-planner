"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import Link from "next/link";
import type { Trip } from "@/types";
import { Pill } from "@/components/ui/badge";
import { Icons } from "@/components/ui/icons";

interface Props {
  initialTrips: Trip[];
}

export function TripsClient({ initialTrips }: Props) {
  const supabase = createClient();
  const [trips, setTrips] = useState<Trip[]>(initialTrips);
  const [showForm, setShowForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    destination: "",
    start_date: "",
    end_date: "",
    interests: "",
    budget: "",
    notes: "",
  });

  async function handleGenerate() {
    if (!form.destination || !form.start_date || !form.end_date) return;
    setGenerating(true);

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
        setForm({ destination: "", start_date: "", end_date: "", interests: "", budget: "", notes: "" });
      }
    } catch (err) {
      console.error("Trip generation failed:", err);
    } finally {
      setGenerating(false);
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

  const inputClass =
    "w-full rounded-lg border border-[var(--color-border)] bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-300)]";

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
          <p className="text-sm text-[var(--color-text-muted)]">
            Plan your next adventure with AI-generated itineraries.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-full bg-[var(--color-brand-600)] px-4 lg:px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-700)] transition-colors flex-shrink-0"
        >
          {showForm ? (
            <><span>{Icons.close}</span><span className="hidden sm:inline">Cancel</span></>
          ) : (
            <><span>{Icons.plus}</span><span>New Trip</span></>
          )}
        </button>
      </div>

      {/* Create Trip Form */}
      {showForm && (
        <div className="rounded-xl border border-[var(--color-border)] bg-white p-5 lg:p-6 mb-6 lg:mb-8 shadow-sm">
          <h2 className="text-base font-semibold mb-4 lg:mb-5">Plan a new trip</h2>
          <div className="grid gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">Destination</label>
              <input
                type="text"
                placeholder="e.g. Lisbon, Portugal"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5">
                Interests{" "}
                <span className="text-[var(--color-text-muted)] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. food, history, street art, beaches"
                value={form.interests}
                onChange={(e) => setForm({ ...form, interests: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Budget{" "}
                <span className="text-[var(--color-text-muted)] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. $2000"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Notes{" "}
                <span className="text-[var(--color-text-muted)] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. traveling with partner"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>
          <div className="mt-5 lg:mt-6">
            <button
              onClick={handleGenerate}
              disabled={generating || !form.destination || !form.start_date || !form.end_date}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-full bg-[var(--color-brand-600)] px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-700)] transition-colors disabled:opacity-50"
            >
              <span className="text-white">{Icons.sparkle}</span>
              {generating ? "Generating itinerary..." : "Generate Itinerary"}
            </button>
          </div>
        </div>
      )}

      {/* Trip List */}
      {trips.length === 0 && !showForm ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          <div className="w-12 h-12 rounded-xl bg-[var(--color-brand-50)] flex items-center justify-center text-[var(--color-brand-400)] mx-auto mb-3">
            {Icons.map}
          </div>
          <p className="font-medium">No trips planned yet</p>
          <p className="text-sm mt-1">Hit &ldquo;New Trip&rdquo; to start planning your adventure.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              href={`/trips/${trip.id}`}
              className="block rounded-xl border border-[var(--color-border)] bg-white p-4 lg:p-5 shadow-sm hover:shadow-md transition-all hover:border-[var(--color-brand-300)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-[var(--color-brand-50)] flex items-center justify-center text-[var(--color-brand-400)] flex-shrink-0 mt-0.5">
                    {Icons.map}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{trip.title}</h3>
                    <p className="text-xs lg:text-sm text-[var(--color-text-muted)] mt-0.5 truncate">
                      {trip.destination} · {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
                    </p>
                  </div>
                </div>
                <Pill>{tripDuration(trip.start_date, trip.end_date)}</Pill>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
