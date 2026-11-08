"use client";

import { createClient } from "@/lib/supabase/client";
import { useState } from "react";
import { useOwnerId } from "@/lib/household-context";
import type { MealPlanEntry, PantryItem, RecipeIngredient, RecipeWithIngredients } from "@/types";
import { findPantryMatch, formatIngredient, parseIngredientLines } from "@/lib/meals";
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
  setEntries: React.Dispatch<React.SetStateAction<MealPlanEntry[]>>;
  pantry: PantryItem[];
  openRecipeId: string | null;
  onOpenRecipe: (id: string | null) => void;
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
  openRecipeId,
  onOpenRecipe,
}: Props) {
  const supabase = createClient();
  const ownerId = useOwnerId();
  const [search, setSearch] = useState("");
  // null = closed, "new" = creating, otherwise the recipe being edited
  const [editing, setEditing] = useState<RecipeWithIngredients | "new" | null>(null);

  const openRecipe = openRecipeId ? recipes.find((r) => r.id === openRecipeId) : undefined;
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
                return (
                  <button key={recipe.id} onClick={() => onOpenRecipe(recipe.id)} className="text-left">
                    <Card className="h-full hover:ring-primary/30 hover:shadow-md transition-all">
                      <CardContent>
                        <h3 className="font-semibold">{recipe.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1">
                          {recipe.recipe_ingredients.length} ingredient
                          {recipe.recipe_ingredients.length === 1 ? "" : "s"}
                          {href && ` · ${hostname(href)}`}
                        </p>
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

      {openRecipe && !editing && (
        <RecipeDetailModal
          recipe={openRecipe}
          pantry={pantry}
          onClose={() => onOpenRecipe(null)}
          onEdit={() => setEditing(openRecipe)}
          onDelete={() => deleteRecipe(openRecipe)}
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
  pantry,
  onClose,
  onEdit,
  onDelete,
}: {
  recipe: RecipeWithIngredients;
  pantry: PantryItem[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => Promise<string | null>;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const href = safeHref(recipe.source_url);

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
            <Button variant="destructive" onClick={() => setConfirmingDelete(true)} className="mr-auto">
              Delete
            </Button>
            <Button onClick={onEdit}>Edit</Button>
          </>
        )
      }
    >
      <div className="space-y-5 text-sm">
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
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Ingredients
          </h3>
          {recipe.recipe_ingredients.length === 0 ? (
            <p className="text-muted-foreground">No ingredients listed.</p>
          ) : (
            <ul className="space-y-1.5">
              {recipe.recipe_ingredients.map((ing) => {
                const inFridge = findPantryMatch(ing.name, pantry);
                return (
                  <li key={ing.id} className="flex items-start gap-2">
                    <span
                      className={inFridge ? "text-green-600 mt-0.5" : "text-muted-foreground/40 mt-0.5"}
                      title={inFridge ? `In fridge: ${inFridge.name}` : "Not in fridge"}
                    >
                      {inFridge ? Icons.check : "•"}
                    </span>
                    <span>{formatIngredient(ing)}</span>
                  </li>
                );
              })}
            </ul>
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

  const set = (field: keyof RecipeDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setDraft((d) => ({ ...d, [field]: e.target.value }));

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
          <FieldLabel>Name</FieldLabel>
          <Input
            value={draft.title}
            onChange={set("title")}
            placeholder="e.g. Mediterranean turkey bowls"
            className="h-10 text-sm"
          />
        </div>
        <div>
          <FieldLabel optional>Recipe link</FieldLabel>
          <Input
            value={draft.source_url}
            onChange={set("source_url")}
            placeholder="https://…"
            inputMode="url"
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
