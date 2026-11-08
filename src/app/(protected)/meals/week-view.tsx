"use client";

import { createClient } from "@/lib/supabase/client";
import { useMemo, useState } from "react";
import { useOwnerId } from "@/lib/household-context";
import type { MealPlanEntry, MealSlot, PantryItem, RecipeWithIngredients } from "@/types";
import {
  PLANNED_WEEKDAYS,
  addDays,
  buildShoppingList,
  guessCategory,
  startOfWeek,
  toDateStr,
  weekDates,
  type ShoppingLine,
} from "@/lib/meals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ErrorText, FieldLabel, Modal } from "./modal";
import type { MealsTab } from "./meals-client";

interface Props {
  now: Date | null;
  weekStart: Date | null;
  loading: boolean;
  onWeekChange: (start: Date) => void;
  entries: MealPlanEntry[];
  setEntries: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>;
  recipes: RecipeWithIngredients[];
  pantry: PantryItem[];
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>;
  onOpenRecipe: (id: string) => void;
  onGoToTab: (tab: MealsTab) => void;
}

const SLOTS: MealSlot[] = ["dinner", "lunch"];

function formatShort(d: Date) {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function WeekView({
  now,
  weekStart,
  loading,
  onWeekChange,
  entries,
  setEntries,
  recipes,
  pantry,
  setPantry,
  onOpenRecipe,
  onGoToTab,
}: Props) {
  const [editingSlot, setEditingSlot] = useState<{ date: string; slot: MealSlot } | null>(null);

  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  if (!weekStart || !now) {
    return <div className="h-64 rounded-xl bg-muted/50 animate-pulse" />;
  }

  const days = weekDates(weekStart);
  const from = toDateStr(days[0]);
  const to = toDateStr(days[days.length - 1]);
  const weekEntries = entries.filter((e) => e.date >= from && e.date <= to);
  const entryFor = (date: string, slot: MealSlot) =>
    weekEntries.find((e) => e.date === date && e.slot === slot);
  const todayStr = toDateStr(now);
  const isThisWeek = from <= todayStr && todayStr <= toDateStr(addDays(weekStart, 6));

  const editingEntry = editingSlot ? entryFor(editingSlot.date, editingSlot.slot) : undefined;

  return (
    <div>
      {/* Week navigation */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <Button
          variant="outline"
          size="icon"
          aria-label="Previous week"
          onClick={() => onWeekChange(addDays(weekStart, -7))}
        >
          ‹
        </Button>
        <h2 className="font-semibold text-base min-w-[9.5rem] text-center">
          {formatShort(days[0])} – {formatShort(days[PLANNED_WEEKDAYS - 1])}
        </h2>
        <Button
          variant="outline"
          size="icon"
          aria-label="Next week"
          onClick={() => onWeekChange(addDays(weekStart, 7))}
        >
          ›
        </Button>
        {!isThisWeek && (
          <Button variant="ghost" size="sm" onClick={() => onWeekChange(startOfWeek(now))}>
            This week
          </Button>
        )}
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      {/* Day grid */}
      <div className={cn("grid gap-3 lg:grid-cols-5", loading && "opacity-60")}>
        {days.map((day) => {
          const date = toDateStr(day);
          const isToday = date === todayStr;
          return (
            <Card
              key={date}
              size="sm"
              className={cn("gap-2", isToday && "ring-2 ring-[var(--color-brand-400)]")}
            >
              <CardContent className="space-y-2">
                <div className="flex items-baseline justify-between lg:block">
                  <p className="text-sm font-semibold">
                    {day.toLocaleDateString("en-US", { weekday: "long" })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatShort(day)}
                    {isToday && " · Today"}
                  </p>
                </div>
                {SLOTS.map((slot) => {
                  const entry = entryFor(date, slot);
                  const recipe = entry?.recipe_id ? recipesById.get(entry.recipe_id) : undefined;
                  const label = recipe?.title ?? entry?.title;
                  return (
                    <div key={slot}>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                        {slot}
                      </p>
                      <button
                        onClick={() => setEditingSlot({ date, slot })}
                        className={cn(
                          "w-full text-left rounded-lg px-2.5 transition-colors",
                          slot === "dinner" ? "py-2.5 text-sm" : "py-1.5 text-xs",
                          label
                            ? recipe
                              ? "bg-secondary text-foreground font-medium hover:bg-secondary/70"
                              : "bg-muted text-foreground hover:bg-muted/70"
                            : "border border-dashed border-border text-muted-foreground hover:border-ring hover:text-foreground"
                        )}
                      >
                        {label ?? `+ Add ${slot}`}
                      </button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ShoppingList
        weekEntries={weekEntries}
        recipes={recipes}
        pantry={pantry}
        setPantry={setPantry}
        onGoToTab={onGoToTab}
      />

      {editingSlot && (
        <SlotModal
          date={editingSlot.date}
          slot={editingSlot.slot}
          entry={editingEntry}
          recipes={recipes}
          onClose={() => setEditingSlot(null)}
          setEntries={setEntries}
          onOpenRecipe={onOpenRecipe}
          onGoToTab={onGoToTab}
        />
      )}
    </div>
  );
}

// ── Pick a recipe or write a note for one slot ───────────────────────────────

function SlotModal({
  date,
  slot,
  entry,
  recipes,
  onClose,
  setEntries,
  onOpenRecipe,
  onGoToTab,
}: {
  date: string;
  slot: MealSlot;
  entry: MealPlanEntry | undefined;
  recipes: RecipeWithIngredients[];
  onClose: () => void;
  setEntries: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>;
  onOpenRecipe: (id: string) => void;
  onGoToTab: (tab: MealsTab) => void;
}) {
  const supabase = createClient();
  const ownerId = useOwnerId();
  const [search, setSearch] = useState("");
  const [note, setNote] = useState(entry && !entry.recipe_id ? entry.title : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayLabel = new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const query = search.trim().toLowerCase();
  const matches = recipes.filter((r) => r.title.toLowerCase().includes(query));
  const linkedRecipe = entry?.recipe_id ? recipes.find((r) => r.id === entry.recipe_id) : undefined;

  async function save(recipe_id: string | null, title: string) {
    setSaving(true);
    setError(null);
    const { data, error } = await supabase
      .from("meal_plan_entries")
      .upsert({ user_id: ownerId, date, slot, recipe_id, title }, { onConflict: "user_id,date,slot" })
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      setError(error?.message ?? "Couldn't save this meal.");
      return;
    }
    setEntries((prev) => [
      ...prev.filter((e) => !(e.date === date && e.slot === slot)),
      data as MealPlanEntry,
    ]);
    onClose();
  }

  async function clear() {
    if (!entry) return;
    setSaving(true);
    const { error } = await supabase.from("meal_plan_entries").delete().eq("id", entry.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
    onClose();
  }

  return (
    <Modal
      title={<span className="capitalize">{slot} · {dayLabel}</span>}
      onClose={onClose}
      footer={
        entry ? (
          <>
            {linkedRecipe && (
              <Button
                variant="outline"
                className="mr-auto"
                onClick={() => {
                  onClose();
                  onOpenRecipe(linkedRecipe.id);
                }}
              >
                View recipe
              </Button>
            )}
            <Button variant="destructive" onClick={clear} disabled={saving}>
              Clear {slot}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="space-y-5">
        <div>
          <FieldLabel>Pick a recipe</FieldLabel>
          {recipes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No saved recipes yet.{" "}
              <button
                onClick={() => {
                  onClose();
                  onGoToTab("recipes");
                }}
                className="text-primary font-medium hover:underline"
              >
                Add one in Recipes
              </button>
            </p>
          ) : (
            <>
              {recipes.length > 6 && (
                <Input
                  placeholder="Search recipes"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 text-sm mb-2"
                />
              )}
              <ul className="max-h-60 overflow-y-auto rounded-lg ring-1 ring-foreground/10 divide-y divide-border">
                {matches.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => save(r.id, r.title)}
                      disabled={saving}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-2",
                        entry?.recipe_id === r.id && "bg-secondary font-medium"
                      )}
                    >
                      <span className="truncate">{r.title}</span>
                      {entry?.recipe_id === r.id && (
                        <span className="text-primary flex-shrink-0">{Icons.check}</span>
                      )}
                    </button>
                  </li>
                ))}
                {matches.length === 0 && (
                  <li className="px-3 py-2.5 text-sm text-muted-foreground">No matches</li>
                )}
              </ul>
            </>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (note.trim()) save(null, note.trim());
          }}
        >
          <FieldLabel>Or write a note</FieldLabel>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. Leftovers, Eating out"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="h-10 text-sm"
            />
            <Button type="submit" variant="outline" disabled={saving || !note.trim()} className="h-10">
              Save
            </Button>
          </div>
        </form>

        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Modal>
  );
}

// ── Shopping list: the week's ingredients minus what's in the fridge ─────────

function ShoppingList({
  weekEntries,
  recipes,
  pantry,
  setPantry,
  onGoToTab,
}: {
  weekEntries: MealPlanEntry[];
  recipes: RecipeWithIngredients[];
  pantry: PantryItem[];
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>;
  onGoToTab: (tab: MealsTab) => void;
}) {
  const supabase = createClient();
  const ownerId = useOwnerId();
  // Items the fridge matched but you still want to buy (e.g. not enough left)
  const [forcedNeeds, setForcedNeeds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = buildShoppingList(weekEntries, recipes, pantry);
  const toBuy = lines.filter((l) => !l.match || forcedNeeds.has(l.key));
  const haveIt = lines.filter((l) => l.match && !forcedNeeds.has(l.key));
  const hasPlannedRecipes = weekEntries.some((e) => e.recipe_id && recipes.some((r) => r.id === e.recipe_id));

  function unforce(key: string) {
    setForcedNeeds((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }

  async function gotIt(line: ShoppingLine) {
    if (line.match) {
      unforce(line.key);
      return;
    }
    setAdding(line.key);
    setError(null);
    const { data, error } = await supabase
      .from("pantry_items")
      .insert({ user_id: ownerId, name: line.name, category: guessCategory(line.name) })
      .select()
      .single();
    setAdding(null);
    if (error || !data) {
      setError(error?.message ?? "Couldn't add that to the fridge.");
      return;
    }
    setPantry((prev) => [...prev, data as PantryItem]);
  }

  async function copyList() {
    const text = toBuy.map((l) => (l.quantities.length ? `${l.name} (${l.quantities.join(" + ")})` : l.name)).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy to the clipboard.");
    }
  }

  return (
    <section className="mt-8 max-w-2xl">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Shopping list
        </h2>
        {toBuy.length > 0 && (
          <Button variant="outline" size="sm" onClick={copyList}>
            {copied ? "Copied" : "Copy list"}
          </Button>
        )}
      </div>

      {!hasPlannedRecipes ? (
        <p className="text-sm text-muted-foreground">
          Plan meals using saved recipes and the ingredients you still need will show up here.
        </p>
      ) : lines.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          This week&apos;s recipes don&apos;t have ingredients listed yet.
        </p>
      ) : (
        <div className="space-y-4">
          {pantry.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Your fridge is empty, so everything is listed.{" "}
              <button onClick={() => onGoToTab("fridge")} className="text-primary font-medium hover:underline">
                Add what you have
              </button>{" "}
              to shorten the list.
            </p>
          )}

          {toBuy.length > 0 ? (
            <ul className="rounded-xl ring-1 ring-foreground/10 bg-card divide-y divide-border">
              {toBuy.map((line) => (
                <li key={line.key} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {line.name}
                      {line.quantities.length > 0 && (
                        <span className="font-normal text-muted-foreground"> · {line.quantities.join(" + ")}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">For {line.recipes.join(", ")}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => gotIt(line)}
                    disabled={adding === line.key}
                    title="Bought it — add to the fridge"
                    className="gap-1 flex-shrink-0"
                  >
                    {Icons.check}
                    Got it
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">You have everything for this week&apos;s recipes.</p>
          )}

          {haveIt.length > 0 && (
            <details className="group">
              <summary className="text-sm text-muted-foreground cursor-pointer select-none">
                Already in your fridge ({haveIt.length})
              </summary>
              <ul className="mt-2 rounded-xl ring-1 ring-foreground/10 bg-card divide-y divide-border">
                {haveIt.map((line) => (
                  <li key={line.key} className="flex items-center gap-3 px-4 py-2">
                    <p className="flex-1 min-w-0 text-sm">
                      {line.name}
                      {line.match && line.match.name.toLowerCase() !== line.name.toLowerCase() && (
                        <span className="text-muted-foreground"> · have {line.match.name}</span>
                      )}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setForcedNeeds((prev) => new Set(prev).add(line.key))}
                      className="flex-shrink-0"
                    >
                      Need more
                    </Button>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {error && <ErrorText>{error}</ErrorText>}
        </div>
      )}
    </section>
  );
}
