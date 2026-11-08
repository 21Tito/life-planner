"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useOwnerId } from "@/lib/household-context";
import type { MealPlanEntry, MealSlot, PantryItem, RecipeWithIngredients, ShoppingItem } from "@/types";
import {
  PLANNED_WEEKDAYS,
  addDays,
  buildShoppingList,
  isOnList,
  planningWeekStart,
  recipeReadiness,
  suggestRecipes,
  toDateStr,
  weekDates,
} from "@/lib/meals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Icons } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { ErrorText, FieldLabel, Modal } from "./modal";
import { ReadinessText } from "./readiness";
import type { EditingSlot, MealsTab } from "./meals-client";

interface Props {
  now: Date | null;
  weekStart: Date | null;
  loading: boolean;
  onWeekChange: (start: Date) => void;
  entries: MealPlanEntry[];
  setEntries: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>;
  recipes: RecipeWithIngredients[];
  pantry: PantryItem[];
  shoppingItems: ShoppingItem[];
  editingSlot: EditingSlot;
  setEditingSlot: (slot: EditingSlot) => void;
  onOpenRecipe: (id: string, entryId?: string) => void;
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
  shoppingItems,
  editingSlot,
  setEditingSlot,
  onOpenRecipe,
  onGoToTab,
}: Props) {
  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  // On phones the days stack vertically, so bring today into view once on arrival
  const scrolledToToday = useRef(false);
  useEffect(() => {
    if (!now || !weekStart || scrolledToToday.current) return;
    scrolledToToday.current = true;
    if (!window.matchMedia("(max-width: 1023px)").matches) return;
    document.getElementById(`day-${toDateStr(now)}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [now, weekStart]);

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
  const currentWeek = planningWeekStart(now);
  const isCurrentWeek = toDateStr(weekStart) === toDateStr(currentWeek);

  const editingEntry = editingSlot ? entryFor(editingSlot.date, editingSlot.slot) : undefined;
  const plannedIds = new Set(weekEntries.flatMap((e) => (e.recipe_id ? [e.recipe_id] : [])));
  const openDinner = days.map(toDateStr).find((d) => d >= todayStr && !entryFor(d, "dinner"));

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
        {!isCurrentWeek && (
          <Button variant="ghost" size="sm" onClick={() => onWeekChange(currentWeek)}>
            This week
          </Button>
        )}
        {loading && <span className="text-xs text-muted-foreground">Loading…</span>}
      </div>

      <Suggestions
        recipes={recipes}
        pantry={pantry}
        plannedIds={plannedIds}
        openDinner={openDinner}
        setEntries={setEntries}
        onOpenRecipe={onOpenRecipe}
      />

      {/* Day grid */}
      <div className={cn("grid gap-3 lg:grid-cols-5", loading && "opacity-60")}>
        {days.map((day) => {
          const date = toDateStr(day);
          const isToday = date === todayStr;
          return (
            <Card
              key={date}
              id={`day-${date}`}
              size="sm"
              className={cn("gap-2 scroll-mt-20", isToday && "ring-2 ring-green-500 bg-green-50/60")}
            >
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between gap-2 lg:flex-col lg:items-start lg:gap-0.5">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    {day.toLocaleDateString("en-US", { weekday: "long" })}
                    {isToday && (
                      <span className="rounded-full bg-green-600 text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                        Today
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatShort(day)}</p>
                </div>
                {SLOTS.map((slot) => {
                  const entry = entryFor(date, slot);
                  const recipe = entry?.recipe_id ? recipesById.get(entry.recipe_id) : undefined;
                  const label = recipe?.title ?? entry?.title;
                  const cooked = Boolean(entry?.cooked_at);
                  return (
                    <div key={slot}>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
                        {slot}
                      </p>
                      <button
                        onClick={() =>
                          entry && recipe ? onOpenRecipe(recipe.id, entry.id) : setEditingSlot({ date, slot })
                        }
                        title={recipe ? "Open recipe" : undefined}
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
                        {cooked && <span className="text-green-700 mr-1" aria-label="Cooked">✓</span>}
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

      <ShoppingSummary
        weekEntries={weekEntries}
        recipes={recipes}
        pantry={pantry}
        shoppingItems={shoppingItems}
        onGoToTab={onGoToTab}
      />

      {editingSlot && (
        <SlotModal
          date={editingSlot.date}
          slot={editingSlot.slot}
          entry={editingEntry}
          recipes={recipes}
          pantry={pantry}
          onClose={() => setEditingSlot(null)}
          setEntries={setEntries}
          onOpenRecipe={onOpenRecipe}
          onGoToTab={onGoToTab}
        />
      )}
    </div>
  );
}

type SupabaseBrowser = ReturnType<typeof createClient>;

/** Plans a slot; a newly planned meal always starts out not cooked. */
function upsertEntry(supabase: SupabaseBrowser, values: Omit<MealPlanEntry, "id" | "created_at" | "cooked_at">) {
  return supabase
    .from("meal_plan_entries")
    .upsert({ ...values, cooked_at: null }, { onConflict: "user_id,date,slot" })
    .select()
    .single();
}

// ── Recipes you can make from what's in the kitchen ──────────────────────────

const SUGGESTIONS_SHOWN = 4;

function Suggestions({
  recipes,
  pantry,
  plannedIds,
  openDinner,
  setEntries,
  onOpenRecipe,
}: {
  recipes: RecipeWithIngredients[];
  pantry: PantryItem[];
  plannedIds: Set<string>;
  openDinner: string | undefined;
  setEntries: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>;
  onOpenRecipe: (id: string) => void;
}) {
  const supabase = createClient();
  const ownerId = useOwnerId();
  const [showAll, setShowAll] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (recipes.length === 0) return null;

  const suggestions = suggestRecipes(recipes, pantry, plannedIds).filter((s) => !s.planned);
  const shown = showAll ? suggestions : suggestions.slice(0, SUGGESTIONS_SHOWN);
  const anyStarred = recipes.some((r) => r.recipe_ingredients.some((i) => i.is_essential));
  const openDay = openDinner
    ? new Date(`${openDinner}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" })
    : null;

  async function plan(recipe: RecipeWithIngredients) {
    if (!openDinner) return;
    setAdding(recipe.id);
    setError(null);
    const { data, error } = await upsertEntry(supabase, {
      user_id: ownerId,
      date: openDinner,
      slot: "dinner",
      recipe_id: recipe.id,
      title: recipe.title,
    });
    setAdding(null);
    if (error || !data) {
      setError(error?.message ?? "Couldn't add that meal.");
      return;
    }
    setEntries((prev) => [
      ...prev.filter((e) => !(e.date === openDinner && e.slot === "dinner")),
      data as MealPlanEntry,
    ]);
  }

  return (
    <section className="mb-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        You can make
      </h2>
      {suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {anyStarred
            ? "Nothing's ready with what's in your kitchen right now."
            : "Star the key ingredients in your recipes, and meals you can make with what you have will show up here."}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {shown.map((s) => (
            <div
              key={s.recipe.id}
              className="rounded-xl ring-1 ring-foreground/10 bg-card pl-3 pr-2 py-2 flex items-center gap-2"
            >
              <button onClick={() => onOpenRecipe(s.recipe.id)} className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate">{s.recipe.title}</p>
                <ReadinessText readiness={s} />
              </button>
              {openDay && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => plan(s.recipe)}
                  disabled={adding === s.recipe.id}
                  title={`Plan for ${openDay} dinner`}
                  className="flex-shrink-0"
                >
                  + {openDay}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {suggestions.length > SUGGESTIONS_SHOWN && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-2 text-sm text-primary font-medium hover:underline"
        >
          {showAll ? "Show fewer" : `Show all ${suggestions.length}`}
        </button>
      )}
      {error && <div className="mt-2"><ErrorText>{error}</ErrorText></div>}
    </section>
  );
}

// ── Pick a recipe or write a note for one slot ───────────────────────────────

const STATUS_RANK = { ready: 0, almost: 1 } as const;

function SlotModal({
  date,
  slot,
  entry,
  recipes,
  pantry,
  onClose,
  setEntries,
  onOpenRecipe,
  onGoToTab,
}: {
  date: string;
  slot: MealSlot;
  entry: MealPlanEntry | undefined;
  recipes: RecipeWithIngredients[];
  pantry: PantryItem[];
  onClose: () => void;
  setEntries: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>;
  onOpenRecipe: (id: string, entryId?: string) => void;
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
  // Recipes you can make with what's in the kitchen are listed first
  const ranked = recipes
    .map((recipe) => ({ recipe, readiness: recipeReadiness(recipe, pantry) }))
    .sort((a, b) => {
      const ra = a.readiness.status ? STATUS_RANK[a.readiness.status] : 2;
      const rb = b.readiness.status ? STATUS_RANK[b.readiness.status] : 2;
      return ra - rb || a.recipe.title.localeCompare(b.recipe.title);
    });
  const matches = ranked.filter(({ recipe }) => recipe.title.toLowerCase().includes(query));
  const linkedRecipe = entry?.recipe_id ? recipes.find((r) => r.id === entry.recipe_id) : undefined;

  async function save(recipe_id: string | null, title: string) {
    setSaving(true);
    setError(null);
    const { data, error } = await upsertEntry(supabase, { user_id: ownerId, date, slot, recipe_id, title });
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
                  onOpenRecipe(linkedRecipe.id, entry?.id);
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
                {matches.map(({ recipe: r, readiness }) => (
                  <li key={r.id}>
                    <button
                      onClick={() => save(r.id, r.title)}
                      disabled={saving}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors flex items-center justify-between gap-3",
                        entry?.recipe_id === r.id && "bg-secondary font-medium"
                      )}
                    >
                      <span className="truncate">{r.title}</span>
                      {entry?.recipe_id === r.id ? (
                        <span className="text-primary flex-shrink-0">{Icons.check}</span>
                      ) : (
                        <ReadinessText readiness={readiness} className="flex-shrink-0 max-w-[50%]" />
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

// ── Link to the shopping list, with what this week's recipes still need ──────

function ShoppingSummary({
  weekEntries,
  recipes,
  pantry,
  shoppingItems,
  onGoToTab,
}: {
  weekEntries: MealPlanEntry[];
  recipes: RecipeWithIngredients[];
  pantry: PantryItem[];
  shoppingItems: ShoppingItem[];
  onGoToTab: (tab: MealsTab) => void;
}) {
  const onList = shoppingItems.filter((i) => !i.checked).length;
  const stillNeeded = buildShoppingList(weekEntries, recipes, pantry).filter(
    (l) => !l.match && !isOnList(l.name, shoppingItems)
  ).length;

  return (
    <section className="mt-8 max-w-2xl rounded-xl ring-1 ring-foreground/10 bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm">
        <p className="font-medium">
          Shopping list · {onList} item{onList === 1 ? "" : "s"}
        </p>
        <p className="text-muted-foreground text-xs mt-0.5">
          {stillNeeded > 0
            ? `${stillNeeded} ingredient${stillNeeded === 1 ? "" : "s"} for this week's recipes aren't in your kitchen or on the list yet.`
            : "Everything this week's recipes need is in your kitchen or on the list."}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => onGoToTab("shopping")}>
        Open list
      </Button>
    </section>
  );
}
