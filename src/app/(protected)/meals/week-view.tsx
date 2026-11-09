"use client";

import { createClient } from "@/lib/supabase/client";
import { useMemo, useState } from "react";
import { useOwnerId } from "@/lib/household-context";
import type { MealPlanEntry, MealSlot, PantryItem, RecipeWithIngredients, ShoppingItem } from "@/types";
import {
  addDays,
  buildShoppingList,
  expiryStatus,
  formatExpiry,
  isLeftoverMeal,
  isOnList,
  recipeReadiness,
  suggestRecipes,
  toDateStr,
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
  /** Consecutive days to show, starting today */
  days: Date[] | null;
  loadingMore: boolean;
  canShowMore: boolean;
  onShowMore: () => void;
  onShowFewer?: () => void;
  entries: MealPlanEntry[];
  setEntries: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>;
  recipes: RecipeWithIngredients[];
  pantry: PantryItem[];
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>;
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
  days,
  loadingMore,
  canShowMore,
  onShowMore,
  onShowFewer,
  entries,
  setEntries,
  recipes,
  pantry,
  setPantry,
  shoppingItems,
  editingSlot,
  setEditingSlot,
  onOpenRecipe,
  onGoToTab,
}: Props) {
  const recipesById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes]);

  if (!days || !now) {
    return <div className="h-64 rounded-xl bg-muted/50 animate-pulse" />;
  }

  const from = toDateStr(days[0]);
  const to = toDateStr(days[days.length - 1]);
  const weekEntries = entries.filter((e) => e.date >= from && e.date <= to);
  const entryFor = (date: string, slot: MealSlot) =>
    weekEntries.find((e) => e.date === date && e.slot === slot);
  const todayStr = toDateStr(now);

  const editingEntry = editingSlot ? entryFor(editingSlot.date, editingSlot.slot) : undefined;
  const plannedIds = new Set(weekEntries.flatMap((e) => (e.recipe_id ? [e.recipe_id] : [])));
  const openDinner = days.map(toDateStr).find((d) => d >= todayStr && !entryFor(d, "dinner"));

  return (
    <div>
      <Suggestions
        recipes={recipes}
        pantry={pantry}
        plannedIds={plannedIds}
        openDinner={openDinner}
        setEntries={setEntries}
        onOpenRecipe={onOpenRecipe}
      />

      {/* Day grid */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((day) => {
          const date = toDateStr(day);
          const isToday = date === todayStr;
          return (
            <Card
              key={date}
              id={`day-${date}`}
              size="sm"
              className={cn("gap-2 scroll-mt-[calc(4.5rem_+_env(safe-area-inset-top)_+_var(--page-tabs-h,0px))]", isToday && "ring-2 ring-green-500 bg-green-50/60")}
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
                        {entry?.pantry_item_id && !cooked && (
                          <span className="inline-block align-[-2px] mr-1 text-sky-600" aria-label="From the freezer">
                            {Icons.snowflake}
                          </span>
                        )}
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canShowMore && (
          <Button variant="outline" onClick={onShowMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Show 7 more days"}
          </Button>
        )}
        {onShowFewer && (
          <Button variant="ghost" onClick={onShowFewer}>
            Show fewer
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {formatShort(days[0])} – {formatShort(days[days.length - 1])}
        </span>
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
          setPantry={setPantry}
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
function upsertEntry(
  supabase: SupabaseBrowser,
  values: Omit<MealPlanEntry, "id" | "created_at" | "cooked_at" | "pantry_item_id"> & { pantry_item_id?: string | null }
) {
  return supabase
    .from("meal_plan_entries")
    .upsert({ ...values, pantry_item_id: values.pantry_item_id ?? null, cooked_at: null }, { onConflict: "user_id,date,slot" })
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
  setPantry,
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
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>;
  onClose: () => void;
  setEntries: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>;
  onOpenRecipe: (id: string, entryId?: string) => void;
  onGoToTab: (tab: MealsTab) => void;
}) {
  const supabase = createClient();
  const ownerId = useOwnerId();
  const [search, setSearch] = useState("");
  const [note, setNote] = useState(entry && !entry.recipe_id && !entry.pantry_item_id ? entry.title : "");
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
  const now = new Date();
  // Oldest first, so whatever should be eaten soonest is at the top
  const freezer = pantry
    .filter((p) => p.category === "frozen")
    .sort((a, b) => (a.expiry_date ?? "9999").localeCompare(b.expiry_date ?? "9999") || a.name.localeCompare(b.name));

  async function save(recipe_id: string | null, title: string, pantry_item_id: string | null = null) {
    setSaving(true);
    setError(null);
    const { data, error } = await upsertEntry(supabase, { user_id: ownerId, date, slot, recipe_id, title, pantry_item_id });
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

  /** A freezer meal was eaten: take it out of the kitchen and tick the meal off. */
  async function markEaten() {
    if (!entry) return;
    setSaving(true);
    setError(null);
    if (entry.pantry_item_id) {
      const { error } = await supabase.from("pantry_items").delete().eq("id", entry.pantry_item_id);
      if (error) {
        setSaving(false);
        setError(error.message);
        return;
      }
      setPantry((prev) => prev.filter((p) => p.id !== entry.pantry_item_id));
    }
    const cooked_at = new Date().toISOString();
    const { error } = await supabase.from("meal_plan_entries").update({ cooked_at }).eq("id", entry.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setEntries((prev) => prev.map((e) => (e.id === entry.id ? { ...e, cooked_at } : e)));
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
            <Button variant="destructive" onClick={clear} disabled={saving} className={linkedRecipe ? undefined : "mr-auto"}>
              Clear {slot}
            </Button>
            {entry.pantry_item_id && !entry.cooked_at && (
              <Button onClick={markEaten} disabled={saving} className="gap-1.5">
                {Icons.check}
                Mark as eaten
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      <div className="space-y-5">
        {entry?.pantry_item_id && (
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            <span className="text-sky-600">{Icons.snowflake}</span>
            {entry.cooked_at ? "Eaten from the freezer." : "From the freezer. Mark it eaten when it's gone."}
          </p>
        )}

        {freezer.length > 0 && (
          <div>
            <FieldLabel>From the freezer</FieldLabel>
            <ul className="max-h-48 overflow-y-auto rounded-lg ring-1 ring-sky-200 bg-sky-50/40 divide-y divide-sky-100">
              {freezer.map((item) => {
                const status = item.expiry_date ? expiryStatus(item.expiry_date, now) : null;
                const selected = entry?.pantry_item_id === item.id;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => save(null, item.name, item.id)}
                      disabled={saving}
                      className={cn(
                        "w-full text-left px-3 py-2.5 text-sm hover:bg-sky-50 transition-colors flex items-center justify-between gap-3",
                        selected && "bg-sky-100 font-medium"
                      )}
                    >
                      <span className="flex items-center gap-2 min-w-0">
                        <span className="text-sky-600 flex-shrink-0">{Icons.snowflake}</span>
                        <span className="truncate">{item.name}</span>
                        {isLeftoverMeal(item) && !/leftover/i.test(item.name) && (
                          <span className="text-[11px] text-muted-foreground flex-shrink-0">Leftovers</span>
                        )}
                      </span>
                      {selected ? (
                        <span className="text-primary flex-shrink-0">{Icons.check}</span>
                      ) : (
                        item.expiry_date && (
                          <span
                            className={cn(
                              "text-xs flex-shrink-0",
                              status === "expired" ? "text-red-600" : status === "soon" ? "text-amber-700" : "text-muted-foreground"
                            )}
                          >
                            {status === "expired" ? "Expired" : "Use by"} {formatExpiry(item.expiry_date)}
                          </span>
                        )
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

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
            ? `${stillNeeded} ingredient${stillNeeded === 1 ? "" : "s"} for upcoming meals aren't in your kitchen or on the list yet.`
            : "Everything your upcoming meals need is in your kitchen or on the list."}
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={() => onGoToTab("shopping")}>
        Open list
      </Button>
    </section>
  );
}
