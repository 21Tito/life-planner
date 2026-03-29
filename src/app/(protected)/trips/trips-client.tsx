"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
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

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 lg:mb-8 gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-display)" }}>
            Trip Planner
          </h1>
          <p className="text-sm text-muted-foreground">
            Plan your next adventure with AI-generated itineraries.
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="rounded-full px-5 h-10 gap-2 flex-shrink-0"
        >
          {showForm ? (
            <><span>{Icons.close}</span><span className="hidden sm:inline">Cancel</span></>
          ) : (
            <><span>{Icons.plus}</span><span>New Trip</span></>
          )}
        </Button>
      </div>

      {/* Create Trip Form */}
      {showForm && (
        <Card className="mb-6 lg:mb-8">
          <CardContent className="pt-5 pb-5 lg:pt-6 lg:pb-6">
            <h2 className="text-base font-semibold mb-4 lg:mb-5">Plan a new trip</h2>
            <div className="grid gap-3 lg:gap-4 grid-cols-1 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">Destination</label>
                <Input
                  placeholder="e.g. Lisbon, Portugal"
                  value={form.destination}
                  onChange={(e) => setForm({ ...form, destination: e.target.value })}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">Start Date</label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">End Date</label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="h-10 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium mb-1.5">
                  Interests{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. food, history, street art, beaches"
                  value={form.interests}
                  onChange={(e) => setForm({ ...form, interests: e.target.value })}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Budget{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. $2000"
                  value={form.budget}
                  onChange={(e) => setForm({ ...form, budget: e.target.value })}
                  className="h-10 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">
                  Notes{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g. traveling with partner"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="h-10 text-sm"
                />
              </div>
            </div>
            <div className="mt-5 lg:mt-6">
              <Button
                onClick={handleGenerate}
                disabled={generating || !form.destination || !form.start_date || !form.end_date}
                className="w-full sm:w-auto rounded-full px-8 h-11 gap-2"
              >
                <span>{Icons.sparkle}</span>
                {generating ? "Generating itinerary..." : "Generate Itinerary"}
              </Button>
            </div>
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
                          {trip.destination} · {formatDate(trip.start_date)} – {formatDate(trip.end_date)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{tripDuration(trip.start_date, trip.end_date)}</Badge>
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
