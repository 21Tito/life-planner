"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { MealPlanEntry, MealSlot, PantryItem, RecipeWithIngredients, Trip } from "@/types";
import {
  EXPIRY_CATEGORIES,
  PANTRY_REVIEW_INTERVAL_DAYS,
  daysSince,
  expiryStatus,
  readinessLabel,
  recipeReadiness,
  PLANNED_DAYS,
  dayRange,
  toDateStr,
} from "@/lib/meals";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

interface Props {
  entries: MealPlanEntry[];
  recipes: RecipeWithIngredients[];
  pantry: PantryItem[];
  shoppingCount: number;
  trips: Trip[];
  reviewedAt: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function recipeHref(entry: MealPlanEntry) {
  return `/meals?recipe=${entry.recipe_id}&entry=${entry.id}`;
}

function localDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`);
}

export function DashboardClient({ entries, recipes, pantry, shoppingCount, trips, reviewedAt }: Props) {
  // "Today" depends on the viewer's timezone, so it's only known after mount
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  if (!now) return <DashboardSkeleton />;

  const today = toDateStr(now);
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const entryFor = (date: string, slot: MealSlot) => entries.find((e) => e.date === date && e.slot === slot);
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const week = dayRange(midnight, PLANNED_DAYS);

  const nextTrip = trips.find((t) => t.end_date >= today);

  const expiring = pantry.filter(
    (p) => p.expiry_date && EXPIRY_CATEGORIES.includes(p.category) && expiryStatus(p.expiry_date, now) !== "ok"
  );
  const reviewAge = reviewedAt ? daysSince(reviewedAt, now) : null;
  const reviewDue = pantry.length > 0 && (reviewAge === null || reviewAge >= PANTRY_REVIEW_INTERVAL_DAYS);

  return (
    <div className="max-w-5xl">
      <h1 className="sr-only">Home</h1>
      <p className="text-sm font-medium text-muted-foreground mb-3">
        {now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
      </p>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="space-y-4 lg:col-span-2">
          <Tonight
            dinner={entryFor(today, "dinner")}
            lunch={entryFor(today, "lunch")}
            recipesById={recipesById}
            pantry={pantry}
          />

          <section className="rounded-2xl ring-1 ring-foreground/10 bg-card">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h2 className="text-sm font-semibold">Next 7 days</h2>
              <Link href="/meals" className="text-sm font-medium text-primary hover:underline">
                Plan
              </Link>
            </div>
            <ul className="pb-2">
              {week.map((day) => {
                const date = toDateStr(day);
                const dinner = entryFor(date, "dinner");
                const recipe = dinner?.recipe_id ? recipesById.get(dinner.recipe_id) : undefined;
                const isToday = date === today;
                const isPast = date < today;
                const label = recipe?.title ?? dinner?.title;
                return (
                  <li key={date}>
                    <Link
                      href={dinner && recipe ? recipeHref(dinner) : "/meals"}
                      className={cn(
                        "mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted",
                        isToday && "bg-green-50 hover:bg-green-100/70 ring-1 ring-green-200"
                      )}
                    >
                      <span className={cn("w-12 flex-shrink-0 text-xs", isPast ? "text-muted-foreground/60" : "text-muted-foreground")}>
                        <span className="block font-semibold uppercase tracking-wide">
                          {day.toLocaleDateString("en-US", { weekday: "short" })}
                        </span>
                        {day.getDate()}
                      </span>
                      <span
                        className={cn(
                          "flex-1 min-w-0 truncate text-sm",
                          label ? "font-medium" : "text-muted-foreground",
                          isPast && !isToday && "text-muted-foreground"
                        )}
                      >
                        {label ?? "Nothing planned"}
                      </span>
                      {dinner?.cooked_at && <span className="text-green-700 text-sm" aria-label="Cooked">✓</span>}
                      {isToday && (
                        <span className="rounded-full bg-green-600 text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                          Today
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        <div className="space-y-3">
          {shoppingCount > 0 && (
            <SideCard
              href="/meals?tab=shopping"
              icon={Icons.check}
              title="Shopping list"
              detail={`${shoppingCount} item${shoppingCount === 1 ? "" : "s"} to buy`}
            />
          )}
          {nextTrip ? (
            <TripCard trip={nextTrip} today={now} />
          ) : (
            <SideCard
              href="/trips?new=1"
              icon={Icons.map}
              title="Plan your next trip"
              detail="Nothing on the calendar yet. Where to next?"
              tone="invite"
            />
          )}
          {(expiring.length > 0 || reviewDue) && (
            <SideCard
              href="/meals?tab=kitchen"
              icon={Icons.utensils}
              title="Kitchen"
              detail={[
                expiring.length > 0 &&
                  `${expiring.length} spice${expiring.length === 1 ? "" : "s"} or sauce${expiring.length === 1 ? "" : "s"} expiring`,
                reviewDue && (reviewAge === null ? "Not reviewed yet" : `Last reviewed ${reviewAge} days ago`),
              ]
                .filter(Boolean)
                .join(" · ")}
              tone="warning"
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ── Tonight: the one thing to act on today ───────────────────────────────────

function Tonight({
  dinner,
  lunch,
  recipesById,
  pantry,
}: {
  dinner: MealPlanEntry | undefined;
  lunch: MealPlanEntry | undefined;
  recipesById: Map<string, RecipeWithIngredients>;
  pantry: PantryItem[];
}) {
  const recipe = dinner?.recipe_id ? recipesById.get(dinner.recipe_id) : undefined;
  const readiness = recipe ? recipeReadiness(recipe, pantry) : null;
  const lunchRecipe = lunch?.recipe_id ? recipesById.get(lunch.recipe_id) : undefined;

  return (
    <section className="rounded-2xl bg-[var(--color-brand-600)] text-white p-5 lg:p-6 shadow-lg">
      <p className="text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">Tonight&apos;s dinner</p>

      {dinner ? (
        <>
          <h2 className="text-2xl lg:text-3xl font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            {recipe?.title ?? dinner.title}
          </h2>
          <p className="mt-1.5 text-sm text-white/80">
            {dinner.cooked_at
              ? "Cooked ✓"
              : readiness && readiness.total > 0
                ? readinessLabel(readiness)
                : !recipe
                  ? "Not a saved recipe"
                  : ""}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {recipe && (
              <Link
                href={recipeHref(dinner)}
                className="inline-flex items-center gap-2 rounded-full bg-white text-[var(--color-brand-600)] px-5 h-11 text-sm font-semibold shadow-sm active:scale-95 transition-transform"
              >
                Open recipe
              </Link>
            )}
            <Link
              href="/meals"
              className="inline-flex items-center rounded-full px-4 h-11 text-sm font-medium text-white/90 ring-1 ring-white/30 hover:bg-white/10"
            >
              Change
            </Link>
          </div>
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold leading-tight" style={{ fontFamily: "var(--font-display)" }}>
            Nothing planned yet
          </h2>
          <p className="mt-1.5 text-sm text-white/80">Pick something from your recipes or kitchen.</p>
          <Link
            href="/meals"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-white text-[var(--color-brand-600)] px-5 h-11 text-sm font-semibold shadow-sm active:scale-95 transition-transform"
          >
            {Icons.plus}
            Plan dinner
          </Link>
        </>
      )}

      {lunch && (
        <Link
          href={lunchRecipe ? recipeHref(lunch) : "/meals"}
          className="mt-5 pt-4 border-t border-white/15 flex items-center justify-between gap-3 text-sm hover:opacity-90"
        >
          <span className="text-white/70">Lunch</span>
          <span className="font-medium truncate">{lunchRecipe?.title ?? lunch.title}</span>
        </Link>
      )}
    </section>
  );
}

// ── Side cards ───────────────────────────────────────────────────────────────

function SideCard({
  href,
  icon,
  title,
  detail,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  detail: string;
  tone?: "warning" | "invite";
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-2xl p-4 transition-all hover:shadow-md",
        tone === "invite"
          ? "border-2 border-dashed border-[var(--color-brand-600)]/25 bg-secondary/40 hover:border-[var(--color-brand-600)]/50"
          : "ring-1 ring-foreground/10 bg-card hover:ring-primary/30"
      )}
    >
      <span
        className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
          tone === "warning" ? "bg-amber-50 text-amber-700" : "bg-secondary text-primary/70"
        )}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className={cn("block text-xs truncate", tone === "warning" ? "text-amber-800" : "text-muted-foreground")}>
          {detail}
        </span>
      </span>
    </Link>
  );
}

function TripCard({ trip, today }: { trip: Trip; today: Date }) {
  const start = localDate(trip.start_date);
  const end = localDate(trip.end_date);
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysUntil = Math.round((start.getTime() - midnight.getTime()) / DAY_MS);
  const when =
    midnight >= start && midnight <= end
      ? "Happening now"
      : daysUntil === 1
        ? "Tomorrow"
        : `In ${daysUntil} days`;
  const dates = `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

  return (
    <SideCard href={`/trips/${trip.id}`} icon={Icons.map} title={trip.destination} detail={`${when} · ${dates}`} />
  );
}

function DashboardSkeleton() {
  return (
    <div className="max-w-5xl animate-pulse">
      <div className="h-4 w-40 bg-[var(--color-border)] rounded mb-3" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="h-48 rounded-2xl bg-[var(--color-border)]" />
          <div className="h-80 rounded-2xl bg-[var(--color-border)]" />
        </div>
        <div className="space-y-3">
          <div className="h-[72px] rounded-2xl bg-[var(--color-border)]" />
          <div className="h-[72px] rounded-2xl bg-[var(--color-border)]" />
        </div>
      </div>
    </div>
  );
}
