"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useOwnerId } from "@/lib/household-context";
import type { MealPlanEntry, PantryItem, RecipeIngredient, RecipeWithIngredients, ShoppingItem } from "@/types";
import {
  findPantryMatch,
  formatIngredient,
  guessEssential,
  ingredientTokens,
  parseIngredientLines,
  recipeReadiness,
} from "@/lib/meals";
import type { ImportedRecipe } from "@/lib/recipe-import";
import { cn } from "@/lib/utils";
import { ReadinessText, StarIcon } from "./readiness";
import { DoneCookingModal } from "./done-cooking";
import type { OpenRecipe } from "./meals-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Icons } from "@/components/ui/icons";
import { ErrorText, FieldLabel, Modal } from "./modal";

interface Props {
  visible: boolean;
  recipes: RecipeWithIngredients[];
  setRecipes: React.Dispatch<React.SetStateAction<RecipeWithIngredients[]>>;
  entries: MealPlanEntry[];
  setEntries: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>;
  pantry: PantryItem[];
  setPantry: React.Dispatch<React.SetStateAction<PantryItem[]>>;
  shoppingItems: ShoppingItem[];
  setShoppingItems: React.Dispatch<React.SetStateAction<ShoppingItem[]>>;
  openRecipe: OpenRecipe;
  onOpenRecipe: (open: OpenRecipe) => void;
  onChangeMeal: (entry: MealPlanEntry) => void;
}

interface RecipeDraft {
  title: string;
  source_url: string;
  ingredientsText: string;
  instructions: string;
  notes: string;
}

function normalizeUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

/** Only ever render http(s) links, never javascript: or data: URLs. */
function safeHref(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function byTitle(a: RecipeWithIngredients, b: RecipeWithIngredients) {
  return a.title.localeCompare(b.title);
}

export function RecipesView({
  visible,
  recipes,
  setRecipes,
  setEntries,
  pantry,
  entries,
  openRecipe: open,
  onOpenRecipe,
  onChangeMeal,
  setPantry,
  shoppingItems,
  setShoppingItems,
}: Props) {
  const supabase = createClient();
  const ownerId = useOwnerId();
  const [search, setSearch] = useState("");
  // null = closed, "new" = creating, otherwise the recipe being edited
  const [editing, setEditing] = useState<RecipeWithIngredients | "new" | null>(null);

  const [cooking, setCooking] = useState(false);
  const openRecipe = open ? recipes.find((r) => r.id === open.id) : undefined;
  const openEntry = open?.entryId ? entries.find((e) => e.id === open.entryId) : undefined;
  const query = search.trim().toLowerCase();
  const filtered = recipes.filter((r) => r.title.toLowerCase().includes(query));

  async function saveRecipe(draft: RecipeDraft, existing: RecipeWithIngredients | null): Promise<string | null> {
    const fields = {
      title: draft.title.trim(),
      source_url: normalizeUrl(draft.source_url),
      instructions: draft.instructions.trim() || null,
      notes: draft.notes.trim() || null,
    };

    const recipeResult = existing
      ? await supabase
          .from("recipes")
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select()
          .single()
      : await supabase
          .from("recipes")
          .insert({ ...fields, user_id: ownerId })
          .select()
          .single();
    if (recipeResult.error || !recipeResult.data) {
      return recipeResult.error?.message ?? "Couldn't save the recipe.";
    }
    const recipe = recipeResult.data;

    const parsed = parseIngredientLines(draft.ingredientsText);
    let ingredients: RecipeIngredient[] = existing?.recipe_ingredients ?? [];
    // Edited lines keep their star when the ingredient itself is the same
    const previousStars = new Map(ingredients.map((i) => [ingredientTokens(i.name).join(" "), i.is_essential]));
    const unchanged =
      existing &&
      parsed.length === ingredients.length &&
      parsed.every((p, i) => p.name === ingredients[i].name && p.quantity === ingredients[i].quantity);

    if (!unchanged) {
      // Insert the new list before deleting the old one so a failure never leaves the recipe empty
      if (parsed.length > 0) {
        const { data, error } = await supabase
          .from("recipe_ingredients")
          .insert(
            parsed.map((p, i) => ({
              recipe_id: recipe.id,
              user_id: ownerId,
              name: p.name,
              quantity: p.quantity,
              sort_order: i,
              is_essential: existing
                ? previousStars.get(ingredientTokens(p.name).join(" ")) ?? false
                : guessEssential(p.name),
            }))
          )
          .select();
        if (error || !data) return error?.message ?? "Saved the recipe, but not its ingredients.";
        ingredients = (data as RecipeIngredient[]).sort((a, b) => a.sort_order - b.sort_order);
      } else {
        ingredients = [];
      }

      const oldIds = existing?.recipe_ingredients.map((i) => i.id) ?? [];
      if (oldIds.length > 0) {
        await supabase.from("recipe_ingredients").delete().in("id", oldIds);
      }
    }

    const saved: RecipeWithIngredients = { ...recipe, recipe_ingredients: ingredients };
    setRecipes((prev) => [...prev.filter((r) => r.id !== saved.id), saved].sort(byTitle));
    // Show the new recipe so its pre-starred essentials can be reviewed
    if (!existing) onOpenRecipe({ id: saved.id });
    return null;
  }

  async function toggleEssential(ing: RecipeIngredient): Promise<string | null> {
    const setStar = (value: boolean) =>
      setRecipes((prev) =>
        prev.map((r) =>
          r.id === ing.recipe_id
            ? {
                ...r,
                recipe_ingredients: r.recipe_ingredients.map((i) =>
                  i.id === ing.id ? { ...i, is_essential: value } : i
                ),
              }
            : r
        )
      );
    setStar(!ing.is_essential);
    const { error } = await supabase
      .from("recipe_ingredients")
      .update({ is_essential: !ing.is_essential })
      .eq("id", ing.id);
    if (error) {
      setStar(ing.is_essential);
      return error.message;
    }
    return null;
  }

  async function deleteRecipe(recipe: RecipeWithIngredients): Promise<string | null> {
    const { error } = await supabase.from("recipes").delete().eq("id", recipe.id);
    if (error) return error.message;
    setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
    // Planned meals keep their title; the database clears their recipe link
    setEntries((prev) => prev.map((e) => (e.recipe_id === recipe.id ? { ...e, recipe_id: null } : e)));
    onOpenRecipe(null);
    return null;
  }

  return (
    <>
      {visible && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {recipes.length > 0 && (
              <Input
                placeholder="Search recipes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-10 text-sm max-w-xs"
              />
            )}
            <Button onClick={() => setEditing("new")} className="rounded-full px-5 h-10 gap-2 ml-auto">
              {Icons.plus}
              New Recipe
            </Button>
          </div>

          {recipes.length === 0 ? (
            <EmptyState
              icon={Icons.utensils}
              title="No recipes yet"
              description="Save the meals you like to make, with a link and the ingredients you need."
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((recipe) => {
                const href = safeHref(recipe.source_url);
                const readiness = recipeReadiness(recipe, pantry);
                return (
                  <button key={recipe.id} onClick={() => onOpenRecipe({ id: recipe.id })} className="text-left">
                    <Card className="h-full hover:ring-primary/30 hover:shadow-md transition-all">
                      <CardContent>
                        <h3 className="font-semibold">{recipe.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {recipe.recipe_ingredients.length} ingredient
                          {recipe.recipe_ingredients.length === 1 ? "" : "s"}
                          {href && ` · ${hostname(href)}`}
                        </p>
                        {readiness.status && <ReadinessText readiness={readiness} className="mt-2" />}
                      </CardContent>
                    </Card>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-sm text-muted-foreground">No recipes match &ldquo;{search}&rdquo;.</p>
              )}
            </div>
          )}
        </div>
      )}

      {openRecipe && cooking && (
        <DoneCookingModal
          recipe={openRecipe}
          entry={openEntry}
          pantry={pantry}
          shoppingItems={shoppingItems}
          setPantry={setPantry}
          setShoppingItems={setShoppingItems}
          setEntries={setEntries}
          onClose={() => setCooking(false)}
          onDone={() => {
            setCooking(false);
            onOpenRecipe(null);
          }}
        />
      )}

      {openRecipe && !editing && !cooking && (
        <RecipeDetailModal
          recipe={openRecipe}
          entry={openEntry}
          onChangeMeal={openEntry ? () => onChangeMeal(openEntry) : undefined}
          onDoneCooking={() => setCooking(true)}
          pantry={pantry}
          onClose={() => onOpenRecipe(null)}
          onEdit={() => setEditing(openRecipe)}
          onDelete={() => deleteRecipe(openRecipe)}
          onToggleEssential={toggleEssential}
        />
      )}

      {editing && (
        <RecipeFormModal
          recipe={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(draft) => saveRecipe(draft, editing === "new" ? null : editing)}
        />
      )}
    </>
  );
}

function RecipeDetailModal({
  recipe,
  entry,
  pantry,
  onClose,
  onEdit,
  onDelete,
  onToggleEssential,
  onChangeMeal,
  onDoneCooking,
}: {
  recipe: RecipeWithIngredients;
  /** Set when opened from a planned meal */
  entry?: MealPlanEntry;
  pantry: PantryItem[];
  onChangeMeal?: () => void;
  onDoneCooking: () => void;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<string | null>;
  onToggleEssential: (ing: RecipeIngredient) => Promise<string | null>;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const href = safeHref(recipe.source_url);
  const readiness = recipeReadiness(recipe, pantry);

  return (
    <Modal
      title={recipe.title}
      onClose={onClose}
      wide
      footer={
        confirmingDelete ? (
          <>
            <p className="text-sm text-muted-foreground mr-auto">Delete this recipe?</p>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={async () => {
                const err = await onDelete();
                if (err) setError(err);
              }}
            >
              Delete
            </Button>
          </>
        ) : (
          <>
            {onChangeMeal ? (
              <Button variant="outline" onClick={onChangeMeal} className="mr-auto">
                Change meal
              </Button>
            ) : (
              <Button variant="destructive" onClick={() => setConfirmingDelete(true)} className="mr-auto">
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={onEdit}>Edit</Button>
            <Button onClick={onDoneCooking} className="gap-1.5">
              {Icons.check}
              {entry?.cooked_at ? "Update fridge" : "Done cooking"}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5 text-sm">
        {entry && (
          <p className="text-xs text-muted-foreground -mt-1">
            Planned for{" "}
            {new Date(`${entry.date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" })} {entry.slot}
            {entry.cooked_at && <span className="text-green-700 font-medium"> · Cooked ✓</span>}
          </p>
        )}
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-primary font-medium hover:underline"
          >
            View on {hostname(href)} ↗
          </a>
        )}

        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ingredients
            </h3>
            {readiness.total > 0 && (
              <ReadinessText readiness={readiness} showUnready />
            )}
          </div>
          {recipe.recipe_ingredients.length === 0 ? (
            <p className="text-muted-foreground">No ingredients listed.</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                Star what this recipe can&apos;t do without, and it&apos;ll be suggested when those are in the
                fridge. Write swaps with &ldquo;or&rdquo;, like &ldquo;chicken or pork&rdquo;.
              </p>
              <ul className="space-y-0.5">
                {recipe.recipe_ingredients.map((ing) => {
                  const inFridge = findPantryMatch(ing.name, pantry);
                  return (
                    <li key={ing.id} className="flex items-center gap-1.5">
                      <button
                        onClick={async () => {
                          const err = await onToggleEssential(ing);
                          setError(err);
                        }}
                        aria-pressed={ing.is_essential}
                        aria-label={ing.is_essential ? `Unstar ${ing.name}` : `Star ${ing.name} as essential`}
                        title={ing.is_essential ? "Essential" : "Mark as essential"}
                        className={cn(
                          "w-7 h-7 flex items-center justify-center rounded-md flex-shrink-0 transition-colors hover:bg-muted",
                          ing.is_essential ? "text-amber-500" : "text-muted-foreground/40 hover:text-muted-foreground"
                        )}
                      >
                        <StarIcon filled={ing.is_essential} />
                      </button>
                      <span
                        className={cn("flex-shrink-0 w-4 flex justify-center", inFridge ? "text-green-600" : "text-muted-foreground/40")}
                        title={inFridge ? `In fridge: ${inFridge.name}` : "Not in fridge"}
                      >
                        {inFridge ? Icons.check : "•"}
                      </span>
                      <span className={cn("py-1", ing.is_essential && "font-medium")}>{formatIngredient(ing)}</span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>

        {recipe.instructions && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Instructions
            </h3>
            <p className="whitespace-pre-wrap leading-relaxed">{recipe.instructions}</p>
          </section>
        )}

        {recipe.notes && (
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Notes
            </h3>
            <p className="whitespace-pre-wrap">{recipe.notes}</p>
          </section>
        )}

        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Modal>
  );
}

function RecipeFormModal({
  recipe,
  onClose,
  onSave,
}: {
  recipe: RecipeWithIngredients | null;
  onClose: () => void;
  onSave: (draft: RecipeDraft) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState<RecipeDraft>({
    title: recipe?.title ?? "",
    source_url: recipe?.source_url ?? "",
    ingredientsText: recipe?.recipe_ingredients.map(formatIngredient).join("\n") ?? "",
    instructions: recipe?.instructions ?? "",
    notes: recipe?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importNote, setImportNote] = useState<string | null>(null);

  const set = (field: keyof RecipeDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [field]: e.target.value }));

  async function importFromLink() {
    const url = draft.source_url.trim();
    if (!url || importing) return;
    setImporting(true);
    setError(null);
    setImportNote(null);
    try {
      const res = await fetch("/api/recipes/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.recipe) {
        setError(data.error ?? "Couldn't import that recipe.");
        return;
      }
      const imported = data.recipe as ImportedRecipe;
      // Ingredients and steps come from the page; a name or notes you've typed are kept
      setDraft((d) => ({
        ...d,
        title: d.title.trim() ? d.title : imported.title,
        ingredientsText: imported.ingredients.length ? imported.ingredients.join("\n") : d.ingredientsText,
        instructions: imported.instructions || d.instructions,
        notes: d.notes.trim() ? d.notes : imported.notes ?? "",
      }));
      const count = imported.ingredients.length;
      setImportNote(
        count
          ? `Imported ${count} ingredient${count === 1 ? "" : "s"}. Review below, then save.`
          : "Imported the recipe, but the page didn't list ingredients. Add them below."
      );
    } catch {
      setError("Couldn't reach the server. Try again.");
    } finally {
      setImporting(false);
    }
  }

  async function save() {
    if (!draft.title.trim()) return;
    setSaving(true);
    setError(null);
    const err = await onSave(draft);
    setSaving(false);
    if (err) setError(err);
    else onClose();
  }

  return (
    <Modal
      title={recipe ? "Edit recipe" : "New recipe"}
      onClose={onClose}
      wide
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !draft.title.trim()}>
            {saving ? "Saving…" : "Save recipe"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <FieldLabel optional>Recipe link</FieldLabel>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              importFromLink();
            }}
            className="flex gap-2"
          >
            <Input
              value={draft.source_url}
              onChange={set("source_url")}
              placeholder="https://…"
              inputMode="url"
              className="h-10 text-sm"
            />
            <Button
              type="submit"
              variant="outline"
              disabled={!draft.source_url.trim() || importing}
              className="h-10 gap-1.5 flex-shrink-0"
            >
              {Icons.download}
              {importing ? "Importing…" : "Import"}
            </Button>
          </form>
          {importNote ? (
            <p className="text-xs text-green-700 mt-1">{importNote}</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">
              Paste a link and hit Import to fill in the ingredients and steps.
            </p>
          )}
        </div>
        <div>
          <FieldLabel>Name</FieldLabel>
          <Input
            value={draft.title}
            onChange={set("title")}
            placeholder="e.g. Mediterranean turkey bowls"
            className="h-10 text-sm"
          />
        </div>
        <div>
          <FieldLabel>Ingredients</FieldLabel>
          <Textarea
            value={draft.ingredientsText}
            onChange={set("ingredientsText")}
            placeholder={"One per line, e.g.\n1 lb ground turkey\n2 cucumbers\n1 cup cherry tomatoes"}
            className="min-h-32 text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            You can paste the list straight from a recipe site.
          </p>
        </div>
        <div>
          <FieldLabel optional>Instructions</FieldLabel>
          <Textarea
            value={draft.instructions}
            onChange={set("instructions")}
            placeholder="Steps, or leave blank if the link has them"
            className="min-h-24 text-sm"
          />
        </div>
        <div>
          <FieldLabel optional>Notes</FieldLabel>
          <Input
            value={draft.notes}
            onChange={set("notes")}
            placeholder="e.g. double the sauce, makes 2 lunches"
            className="h-10 text-sm"
          />
        </div>
        {error && <ErrorText>{error}</ErrorText>}
      </div>
    </Modal>
  );
}
