import type { SupabaseClient } from "@supabase/supabase-js";
import type { MealPlanEntry, PantryItem, RecipeWithIngredients } from "@/types";
import {
  PLANNED_DAYS,
  addDays,
  findPantryMatch,
  formatExpiry,
  guessEssential,
  parseIngredientLines,
  readinessLabel,
  recipeReadiness,
  startOfWeek,
  toDateStr,
} from "@/lib/meals";

/**
 * Tools exposed to Claude over MCP. They run with the service-role client, so every
 * query is explicitly scoped to the household owner. There are deliberately no
 * delete tools: a misled model can add things, but never destroy them.
 */

export interface ToolContext {
  admin: SupabaseClient;
  ownerId: string;
}

/** Errors whose message is safe to show to the model and user. */
export class ToolInputError extends Error {}

type Args = Record<string, unknown>;

interface Tool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  readOnly: boolean;
  /** Overwrites existing data, so clients should confirm with the user first */
  destructive?: boolean;
  handler: (args: Args, ctx: ToolContext) => Promise<unknown>;
}

// ── Input validation ─────────────────────────────────────────────────────────

function optionalString(args: Args, key: string, max: number): string | undefined {
  const value = args[key];
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") throw new ToolInputError(`${key} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw new ToolInputError(`${key} must be at most ${max} characters.`);
  return trimmed || undefined;
}

function requiredString(args: Args, key: string, max: number): string {
  const value = optionalString(args, key, max);
  if (!value) throw new ToolInputError(`${key} is required.`);
  return value;
}

function stringList(args: Args, key: string, maxItems: number, maxLength: number): string[] {
  const value = args[key];
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || !value.every((v) => typeof v === "string")) {
    throw new ToolInputError(`${key} must be a list of strings.`);
  }
  if (value.length > maxItems) throw new ToolInputError(`${key} can have at most ${maxItems} items.`);
  return value
    .map((v: string) => v.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((v) => {
      if (v.length > maxLength) throw new ToolInputError(`Each ${key} item must be at most ${maxLength} characters.`);
      return v;
    });
}

function uuid(args: Args, key: string): string {
  const value = requiredString(args, key, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new ToolInputError(`${key} must be a recipe id from list_recipes.`);
  }
  return value;
}

function calendarDate(value: string, key: string): Date {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const date = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  if (!date || toDateStr(date) !== value) throw new ToolInputError(`${key} must be a date like 2026-11-09.`);
  return date;
}

function httpUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return url.toString();
  } catch {}
  throw new ToolInputError("source_url must be an http(s) link.");
}

// ── Data access (always scoped to the owner) ─────────────────────────────────

async function loadPantry({ admin, ownerId }: ToolContext): Promise<PantryItem[]> {
  const { data, error } = await admin.from("pantry_items").select("*").eq("user_id", ownerId).order("name");
  if (error) throw new Error(error.message);
  return (data ?? []) as PantryItem[];
}

async function loadRecipes({ admin, ownerId }: ToolContext): Promise<RecipeWithIngredients[]> {
  const { data, error } = await admin
    .from("recipes")
    .select("*, recipe_ingredients(*)")
    .eq("user_id", ownerId)
    .order("title");
  if (error) throw new Error(error.message);
  return ((data ?? []) as RecipeWithIngredients[]).map((r) => ({
    ...r,
    recipe_ingredients: [...r.recipe_ingredients].sort((a, b) => a.sort_order - b.sort_order),
  }));
}

function ingredientLine(i: { quantity: string | null; name: string }) {
  return i.quantity ? `${i.quantity} ${i.name}` : i.name;
}

// ── Tools ────────────────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: "get_kitchen",
    title: "Get kitchen inventory",
    description:
      "Lists what's currently in the household's kitchen (fridge and pantry), with categories, expiration month for spices and sauces, and when it was last reviewed.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    readOnly: true,
    async handler(_args, ctx) {
      const [items, status] = await Promise.all([
        loadPantry(ctx),
        ctx.admin.from("pantry_status").select("reviewed_at").eq("user_id", ctx.ownerId).maybeSingle(),
      ]);
      return {
        last_reviewed: status.data?.reviewed_at ?? null,
        items: items.map((i) => ({ name: i.name, category: i.category, expires: i.expiry_date ? formatExpiry(i.expiry_date) : null })),
      };
    },
  },
  {
    name: "list_recipes",
    title: "List saved recipes",
    description:
      "Lists the household's saved recipes with their essential (starred) ingredients and whether they can be made from what's in the kitchen right now.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    readOnly: true,
    async handler(_args, ctx) {
      const [recipes, pantry] = await Promise.all([loadRecipes(ctx), loadPantry(ctx)]);
      return recipes.map((r) => {
        const readiness = recipeReadiness(r, pantry);
        return {
          id: r.id,
          title: r.title,
          essential_ingredients: r.recipe_ingredients.filter((i) => i.is_essential).map((i) => i.name),
          kitchen_status: readiness.status ? readinessLabel(readiness) : `Missing ${readiness.missing.length} of ${readiness.total}`,
          source_url: r.source_url,
        };
      });
    },
  },
  {
    name: "get_recipe",
    title: "Get recipe",
    description: "Gets a saved recipe's full ingredients (marking which are essential and which are in the kitchen), instructions, and notes.",
    inputSchema: {
      type: "object",
      properties: { recipe_id: { type: "string", description: "Recipe id from list_recipes" } },
      required: ["recipe_id"],
      additionalProperties: false,
    },
    readOnly: true,
    async handler(args, ctx) {
      const recipeId = uuid(args, "recipe_id");
      const [{ data, error }, pantry] = await Promise.all([
        ctx.admin
          .from("recipes")
          .select("*, recipe_ingredients(*)")
          .eq("id", recipeId)
          .eq("user_id", ctx.ownerId)
          .maybeSingle(),
        loadPantry(ctx),
      ]);
      if (error) throw new Error(error.message);
      if (!data) throw new ToolInputError("No recipe with that id.");
      const recipe = data as RecipeWithIngredients;
      return {
        id: recipe.id,
        title: recipe.title,
        source_url: recipe.source_url,
        ingredients: [...recipe.recipe_ingredients]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((i) => ({
            ingredient: ingredientLine(i),
            essential: i.is_essential,
            in_kitchen: findPantryMatch(i.name, pantry) !== null,
          })),
        instructions: recipe.instructions,
        notes: recipe.notes,
      };
    },
  },
  {
    name: "get_meal_plan",
    title: "Get meal plan",
    description: "Gets the Sunday–Saturday lunch and dinner plan for the week containing the given date.",
    inputSchema: {
      type: "object",
      properties: {
        week_of: { type: "string", description: "Any date in the week, YYYY-MM-DD. Defaults to the current week." },
      },
      additionalProperties: false,
    },
    readOnly: true,
    async handler(args, ctx) {
      const weekOf = optionalString(args, "week_of", 10);
      const sunday = startOfWeek(weekOf ? calendarDate(weekOf, "week_of") : new Date());
      const days = Array.from({ length: PLANNED_DAYS }, (_, i) => toDateStr(addDays(sunday, i)));

      const { data, error } = await ctx.admin
        .from("meal_plan_entries")
        .select("*")
        .eq("user_id", ctx.ownerId)
        .gte("date", days[0])
        .lte("date", days[days.length - 1]);
      if (error) throw new Error(error.message);
      const entries = (data ?? []) as MealPlanEntry[];

      return days.map((date) => {
        const find = (slot: string) => entries.find((e) => e.date === date && e.slot === slot);
        const describe = (e: MealPlanEntry | undefined) =>
          e ? { title: e.title, recipe_id: e.recipe_id, cooked: Boolean(e.cooked_at) } : null;
        return {
          date,
          day: new Date(`${date}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" }),
          dinner: describe(find("dinner")),
          lunch: describe(find("lunch")),
        };
      });
    },
  },
  {
    name: "save_recipe",
    title: "Save recipe",
    description:
      "Saves a new recipe to the household's recipe library. Only call this when the user asks to save a recipe. " +
      "List essential_ingredients (the few the dish can't be made without, e.g. the protein and main vegetables) so the app can suggest it when they're in the kitchen; use 'or' for swaps like 'chicken or pork'.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", maxLength: 200 },
        ingredients: {
          type: "array",
          items: { type: "string", maxLength: 300 },
          maxItems: 100,
          description: "One ingredient per item with its amount, e.g. '1 lb ground turkey'",
        },
        essential_ingredients: {
          type: "array",
          items: { type: "string", maxLength: 100 },
          maxItems: 20,
          description: "Names of the ingredients the dish can't be made without",
        },
        instructions: { type: "string", maxLength: 20000, description: "Numbered steps, one per line" },
        notes: { type: "string", maxLength: 2000, description: "e.g. servings and total time" },
        source_url: { type: "string", maxLength: 2048, description: "Link to the original recipe, if any" },
      },
      required: ["title", "ingredients"],
      additionalProperties: false,
    },
    readOnly: false,
    async handler(args, ctx) {
      const title = requiredString(args, "title", 200);
      const lines = stringList(args, "ingredients", 100, 300);
      if (lines.length === 0) throw new ToolInputError("ingredients must list at least one ingredient.");
      const essentials = stringList(args, "essential_ingredients", 20, 100);
      const instructions = optionalString(args, "instructions", 20000) ?? null;
      const notes = optionalString(args, "notes", 2000) ?? null;
      const sourceUrl = httpUrl(optionalString(args, "source_url", 2048));

      const { data: recipe, error } = await ctx.admin
        .from("recipes")
        .insert({ user_id: ctx.ownerId, title, instructions, notes, source_url: sourceUrl })
        .select("id")
        .single();
      if (error || !recipe) throw new Error(error?.message ?? "Failed to save recipe");

      const essentialItems = essentials.map((name) => ({ name }) as PantryItem);
      const parsed = lines.flatMap((line) => parseIngredientLines(line));
      const rows = parsed.map((p, i) => ({
        recipe_id: recipe.id,
        user_id: ctx.ownerId,
        name: p.name,
        quantity: p.quantity,
        sort_order: i,
        is_essential: essentials.length
          ? findPantryMatch(p.name, essentialItems) !== null
          : guessEssential(p.name),
      }));
      const { error: ingredientError } = await ctx.admin.from("recipe_ingredients").insert(rows);
      if (ingredientError) {
        await ctx.admin.from("recipes").delete().eq("id", recipe.id).eq("user_id", ctx.ownerId);
        throw new Error(ingredientError.message);
      }

      return {
        saved: true,
        recipe_id: recipe.id,
        title,
        ingredient_count: rows.length,
        essential_ingredients: rows.filter((r) => r.is_essential).map((r) => r.name),
      };
    },
  },
  {
    name: "plan_meal",
    title: "Plan a meal",
    description:
      "Puts a saved recipe or a short note (like 'Leftovers') into a day's lunch or dinner slot, replacing whatever was there. Only call this when the user asks to plan a meal.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date, YYYY-MM-DD" },
        slot: { type: "string", enum: ["dinner", "lunch"] },
        recipe_id: { type: "string", description: "Recipe id from list_recipes or save_recipe" },
        note: { type: "string", maxLength: 200, description: "Use instead of recipe_id for non-recipe meals" },
      },
      required: ["date", "slot"],
      additionalProperties: false,
    },
    readOnly: false,
    destructive: true,
    async handler(args, ctx) {
      const date = requiredString(args, "date", 10);
      calendarDate(date, "date");
      const slot = args.slot;
      if (slot !== "dinner" && slot !== "lunch") throw new ToolInputError("slot must be 'dinner' or 'lunch'.");

      const note = optionalString(args, "note", 200);
      const hasRecipe = args.recipe_id !== undefined && args.recipe_id !== null;
      if (hasRecipe === Boolean(note)) throw new ToolInputError("Provide either recipe_id or note, not both.");

      let recipeId: string | null = null;
      let title = note ?? "";
      if (hasRecipe) {
        recipeId = uuid(args, "recipe_id");
        const { data: recipe } = await ctx.admin
          .from("recipes")
          .select("id, title")
          .eq("id", recipeId)
          .eq("user_id", ctx.ownerId)
          .maybeSingle();
        if (!recipe) throw new ToolInputError("No recipe with that id.");
        title = recipe.title;
      }

      const { data: previous } = await ctx.admin
        .from("meal_plan_entries")
        .select("title")
        .eq("user_id", ctx.ownerId)
        .eq("date", date)
        .eq("slot", slot)
        .maybeSingle();

      const { error } = await ctx.admin
        .from("meal_plan_entries")
        .upsert(
          { user_id: ctx.ownerId, date, slot, recipe_id: recipeId, title, cooked_at: null },
          { onConflict: "user_id,date,slot" }
        );
      if (error) throw new Error(error.message);

      return { planned: { date, slot, title }, replaced: previous?.title ?? null };
    },
  },
];

export const SERVER_INSTRUCTIONS =
  "Life Planner is the user's household meal planner. Check get_kitchen and list_recipes before suggesting meals, " +
  "and favor dishes that use what's already in the kitchen. Only save recipes or plan meals when the user asks.";

export function listTools() {
  return TOOLS.map((t) => ({
    name: t.name,
    title: t.title,
    description: t.description,
    inputSchema: t.inputSchema,
    annotations: { readOnlyHint: t.readOnly, destructiveHint: t.destructive ?? false, openWorldHint: false },
  }));
}

export function findTool(name: unknown): Tool | undefined {
  return TOOLS.find((t) => t.name === name);
}
