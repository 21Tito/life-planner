"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { Trip } from "@/types";

export default function TripsPage() {
  const supabase = createClient();
  const [trips, setTrips] = useState<Trip[]>([]);
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

  useEffect(() => {
    loadTrips();
  }, []);

  async function loadTrips() {
    const { data } = await supabase
      .from("trips")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setTrips(data);
  }

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

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1
            className="text-3xl font-bold mb-1"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Trip Planner
          </h1>
          <p className="text-[var(--color-text-muted)]">
            Plan your next adventure with AI-generated itineraries.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-full bg-[var(--color-brand-600)] px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-700)] transition-colors"
        >
          {showForm ? "Cancel" : "+ New Trip"}
        </button>
      </div>

      {/* Create Trip Form */}
      {showForm && (
        <div className="rounded-2xl border border-[var(--color-border)] bg-white p-6 mb-8 shadow-sm">
          <h2 className="text-lg font-semibold mb-4">Plan a new trip</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Destination</label>
              <input
                type="text"
                placeholder="e.g. Lisbon, Portugal"
                value={form.destination}
                onChange={(e) => setForm({ ...form, destination: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-300)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-300)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input
                type="date"
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-300)]"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">
                Interests <span className="text-[var(--color-text-muted)] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. food, history, street art, beaches, nightlife"
                value={form.interests}
                onChange={(e) => setForm({ ...form, interests: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-300)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Budget <span className="text-[var(--color-text-muted)] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. $2000"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-300)]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Notes <span className="text-[var(--color-text-muted)] font-normal">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. traveling with partner, prefer walkable areas"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-300)]"
              />
            </div>
          </div>
          <div className="mt-6">
            <button
              onClick={handleGenerate}
              disabled={generating || !form.destination || !form.start_date || !form.end_date}
              className="rounded-full bg-[var(--color-brand-600)] px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-700)] transition-colors disabled:opacity-50"
            >
              {generating ? "Generating itinerary..." : "✨ Generate Itinerary"}
            </button>
          </div>
        </div>
      )}

      {/* Trip List */}
      {trips.length === 0 && !showForm ? (
        <div className="text-center py-16 text-[var(--color-text-muted)]">
          <p className="text-4xl mb-3">🌍</p>
          <p>No trips planned yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              href={`/trips/${trip.id}`}
              className="block rounded-xl border border-[var(--color-border)] bg-white p-5 shadow-sm hover:shadow-md transition-all hover:border-[var(--color-brand-300)]"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{trip.title}</h3>
                  <p className="text-sm text-[var(--color-text-muted)] mt-0.5">
                    {trip.destination} · {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
                  </p>
                </div>
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
                  {tripDuration(trip.start_date, trip.end_date)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
