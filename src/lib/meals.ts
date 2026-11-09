import type {
  MealPlanEntry,
  PantryCategory,
  PantryItem,
  RecipeIngredient,
  RecipeWithIngredients,
} from "@/types";

export const PLANNED_DAYS = 7; // Sunday–Saturday
export const PANTRY_REVIEW_INTERVAL_DAYS = 7;

// ── Dates (local time, so the week matches the viewer's calendar) ────────────

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Weeks start on Sunday. */
export function startOfWeek(d: Date): Date {
  return addDays(d, -d.getDay());
}

/** `count` consecutive days starting at `start` (local midnight). */
export function dayRange(start: Date, count: number): Date[] {
  return Array.from({ length: count }, (_, i) => addDays(start, i));
}

export function daysSince(iso: string, now = new Date()): number {
  // Clamped: a timestamp from moments after `now` was captured would otherwise floor to -1
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

// ── Ingredient text ──────────────────────────────────────────────────────────

const QTY = String.raw`(?:\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[½¼¾⅓⅔⅛])`;
const UNITS = [
  "cups?", "tbsps?", "tablespoons?", "tsps?", "teaspoons?", "lbs?", "pounds?",
  "oz", "ounces?", "g", "grams?", "kg", "ml", "l", "liters?", "cloves?", "cans?",
  "jars?", "bunch(?:es)?", "heads?", "pinch(?:es)?", "handfuls?", "pieces?",
  "slices?", "packages?", "pkgs?", "sticks?", "sprigs?", "stalks?", "dash(?:es)?",
].join("|");
const LEADING_QUANTITY = new RegExp(
  String.raw`^(${QTY}(?:\s*(?:-|to)\s*${QTY})?(?:\s+${QTY})?(?:\s*(?:${UNITS})\b\.?)?)\s+(.+)$`,
  "i"
);

/** Splits pasted lines like "2 cups cooked rice" into { quantity: "2 cups", name: "cooked rice" }. */
export function parseIngredientLines(text: string): { name: string; quantity: string | null }[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•▢☐]|\d+\.)\s+/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(LEADING_QUANTITY);
      return m ? { quantity: m[1].trim(), name: m[2].trim() } : { quantity: null, name: line };
    });
}

export function formatIngredient(i: Pick<RecipeIngredient, "name" | "quantity">): string {
  return i.quantity ? `${i.quantity} ${i.name}` : i.name;
}

// ── Matching recipe ingredients against the kitchen ───────────────────────────

const IGNORED_WORDS = new Set([
  "fresh", "chopped", "diced", "minced", "sliced", "shredded", "grated", "crushed",
  "peeled", "cubed", "large", "medium", "small", "boneless", "skinless", "organic",
  "finely", "roughly", "thinly", "optional", "divided", "can", "canned", "jar",
  "package", "of", "a", "an", "the", "and", "or", "to", "taste", "for",
  "about", "approximately", "such", "as", "like", "any", "your", "favorite", "choice", "frozen",
  // Units, for names where the amount wasn't split off or sits in parentheses
  "g", "l", "oz", "ounce", "ounces", "lb", "lbs", "pound", "pounds", "gram", "grams", "kg",
  "ml", "cup", "cups", "tbsp", "tsp", "tablespoon", "tablespoons", "teaspoon", "teaspoons",
  "inch", "inches",
]);

const NEVER_SHOP_FOR = new Set(["water", "ice"]);

function singular(word: string): string {
  if (word.length <= 3 || word.endsWith("ss")) return word;
  if (word.endsWith("ies")) return word.slice(0, -3) + "y";
  if (word.endsWith("oes")) return word.slice(0, -2);
  if (/(?:sh|ch|x)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s")) return word.slice(0, -1);
  return word;
}

function meaningfulWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !IGNORED_WORDS.has(w));
}

/**
 * The part before prep notes: "chicken breast, cubed" → "chicken breast".
 * Keeps leading descriptor-only segments, as in "boneless, skinless chicken breast".
 */
function coreName(name: string): string {
  let core = "";
  for (const segment of name.replace(/\([^)]*\)/g, " ").split(",")) {
    core = core ? `${core} ${segment}` : segment;
    if (meaningfulWords(core).length > 0) break;
  }
  return core.replace(/\s+/g, " ").trim();
}

/** "Boneless chicken breasts, cubed (about 2)" → ["chicken", "breast"] */
export function ingredientTokens(name: string): string[] {
  return meaningfulWords(coreName(name)).map(singular);
}

// Cuts and forms of the same ingredient: "chicken breast" in the kitchen works for "chicken thighs"
const CUT_WORDS = new Set([
  "breast", "thigh", "leg", "drumstick", "wing", "tender", "tenderloin", "cutlet", "fillet",
  "filet", "loin", "shoulder", "chop", "rib", "belly", "butt", "sirloin", "flank", "strip",
  "steak", "ground", "mince", "piece", "whole",
]);

// Products made from an ingredient: "chicken" in the kitchen doesn't cover "chicken broth"
const PRODUCT_WORDS = new Set([
  "broth", "stock", "bouillon", "sauce", "powder", "seasoning", "paste", "oil", "vinegar",
  "extract", "cube", "flake",
]);

function tokensMatch(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;

  const productsA = a.filter((t) => PRODUCT_WORDS.has(t)).sort().join(" ");
  const productsB = b.filter((t) => PRODUCT_WORDS.has(t)).sort().join(" ");
  if (productsA !== productsB) return false;

  const withoutCuts = (tokens: string[]) => {
    const kept = tokens.filter((t) => !CUT_WORDS.has(t));
    return kept.length ? kept : tokens;
  };
  const coreA = withoutCuts(a);
  const coreB = withoutCuts(b);
  const setA = new Set(coreA);
  const setB = new Set(coreB);
  return coreA.every((t) => setB.has(t)) || coreB.every((t) => setA.has(t));
}

/**
 * Every way to satisfy an ingredient; any one of them will do.
 * "chicken or pork", "chicken/pork" → [["chicken"], ["pork"]]
 * "Ground Meat (Turkey, Beef, Pork)" → [["ground", "meat"], ["turkey"], ["beef"], ["pork"]]
 */
function alternatives(name: string): string[][] {
  const fromParentheses = [...name.matchAll(/\(([^)]*)\)/g)].flatMap((m) => m[1].split(/,|\s+or\s+|\//i));
  return [...coreName(name).split(/\s+or\s+|\s*\/\s*/i), ...fromParentheses]
    .map((alt) => meaningfulWords(alt).map(singular))
    .filter((tokens) => tokens.length > 0);
}

const MEATS = new Set([
  "chicken", "turkey", "beef", "pork", "lamb", "veal", "bison", "sausage", "bacon", "ham", "steak",
]);

/** "meat" / "ground meat" in a recipe: any meat in the kitchen counts */
function isGenericMeat(tokens: string[]): boolean {
  const core = tokens.filter((t) => !CUT_WORDS.has(t));
  return core.length === 1 && core[0] === "meat";
}

const LEFTOVER_PATTERN = /\bleft\s?overs?\b/i;

/** Frozen leftovers from Done cooking, or anything named like "Leftover chili". */
export function isLeftoverMeal(item: Pick<PantryItem, "name" | "recipe_id">): boolean {
  return Boolean(item.recipe_id) || LEFTOVER_PATTERN.test(item.name);
}

export function findPantryMatch(name: string, pantry: PantryItem[]): PantryItem | null {
  // Leftovers are prepared meals, not ingredients
  pantry = pantry.filter((p) => !isLeftoverMeal(p));
  for (const tokens of alternatives(name)) {
    const match = isGenericMeat(tokens)
      ? pantry.find((p) => ingredientTokens(p.name).some((t) => MEATS.has(t)))
      : pantry.find((p) => tokensMatch(tokens, ingredientTokens(p.name)));
    if (match) return match;
  }
  return null;
}

/** "(15 oz) can chickpeas, drained" → "chickpeas", for the shopping list and kitchen. */
export function shoppingName(name: string): string {
  const words = coreName(name).split(" ");
  while (words.length > 1 && IGNORED_WORDS.has(words[0].toLowerCase())) words.shift();
  return words.join(" ") || name.trim();
}

export interface ShoppingLine {
  key: string;
  name: string;
  quantities: string[];
  recipes: string[];
  match: PantryItem | null;
}

/** Combines the week's recipe ingredients and marks the ones already in the kitchen. */
export function buildShoppingList(
  entries: MealPlanEntry[],
  recipes: RecipeWithIngredients[],
  pantry: PantryItem[]
): ShoppingLine[] {
  const recipesById = new Map(recipes.map((r) => [r.id, r]));
  const lines = new Map<string, ShoppingLine>();

  for (const entry of entries) {
    const recipe = entry.recipe_id ? recipesById.get(entry.recipe_id) : undefined;
    if (!recipe) continue;

    for (const ing of recipe.recipe_ingredients) {
      const tokens = ingredientTokens(ing.name);
      const key = tokens.join(" ");
      if (!key || NEVER_SHOP_FOR.has(key)) continue;

      let line = lines.get(key);
      if (!line) {
        line = { key, name: shoppingName(ing.name), quantities: [], recipes: [], match: findPantryMatch(ing.name, pantry) };
        lines.set(key, line);
      }
      if (ing.quantity) line.quantities.push(ing.quantity);
      if (!line.recipes.includes(recipe.title)) line.recipes.push(recipe.title);
    }
  }

  return [...lines.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── Suggestions: recipes you can make from the kitchen ────────────────────────

export type ReadinessStatus = "ready" | "almost";

export interface Readiness {
  status: ReadinessStatus | null;
  missing: string[];
  have: number;
  total: number;
  /** False when no ingredients are starred, so every ingredient is counted instead */
  basedOnEssentials: boolean;
}

const FALLBACK_READY_RATIO = 0.75;
const FALLBACK_ALMOST_RATIO = 0.5;

export function recipeReadiness(recipe: RecipeWithIngredients, pantry: PantryItem[]): Readiness {
  const essentials = recipe.recipe_ingredients.filter((i) => i.is_essential);
  const basedOnEssentials = essentials.length > 0;
  const pool = basedOnEssentials ? essentials : recipe.recipe_ingredients;
  const missing = pool.filter((i) => !findPantryMatch(i.name, pantry)).map((i) => shoppingName(i.name));
  const total = pool.length;
  const have = total - missing.length;

  let status: ReadinessStatus | null = null;
  if (have > 0) {
    if (basedOnEssentials) {
      status = missing.length === 0 ? "ready" : missing.length === 1 ? "almost" : null;
    } else {
      const ratio = have / total;
      status = ratio >= FALLBACK_READY_RATIO ? "ready" : ratio >= FALLBACK_ALMOST_RATIO ? "almost" : null;
    }
  }
  return { status, missing, have, total, basedOnEssentials };
}

export function readinessLabel(r: Readiness): string {
  if (!r.basedOnEssentials) return `Have ${r.have} of ${r.total}`;
  if (r.missing.length === 0) return "Ready to make";
  return `Need ${r.missing.join(", ")}`;
}

export interface RecipeSuggestion extends Readiness {
  recipe: RecipeWithIngredients;
  status: ReadinessStatus;
  planned: boolean;
}

/** Ranks recipes by what's in the kitchen; ones already planned this week go last for variety. */
export function suggestRecipes(
  recipes: RecipeWithIngredients[],
  pantry: PantryItem[],
  plannedRecipeIds: Set<string>
): RecipeSuggestion[] {
  const suggestions: RecipeSuggestion[] = [];
  for (const recipe of recipes) {
    const readiness = recipeReadiness(recipe, pantry);
    if (readiness.status) {
      suggestions.push({ ...readiness, status: readiness.status, recipe, planned: plannedRecipeIds.has(recipe.id) });
    }
  }
  const rank = (s: RecipeSuggestion) => [
    s.planned ? 1 : 0,
    s.status === "ready" ? 0 : 1,
    s.basedOnEssentials ? 0 : 1,
    s.missing.length,
  ];
  return suggestions.sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
    return a.recipe.title.localeCompare(b.recipe.title);
  });
}

const MINOR_INGREDIENTS = new Set(["garlic", "shallot", "scallion", "ginger", "flour"]);

/** Pre-stars likely essentials (proteins, main vegetables, starches) on new recipes. */
export function guessEssential(name: string): boolean {
  if (/\b(optional|garnish|to taste|for serving)\b/i.test(name)) return false;
  const tokens = ingredientTokens(name);
  if (tokens.some((t) => MINOR_INGREDIENTS.has(t)) || tokens.join(" ") === "green onion") return false;
  const category = guessCategory(name);
  return category === "protein" || category === "vegetable" || category === "grain";
}

// ── Kitchen categories ───────────────────────────────────────────────────────

export const PANTRY_CATEGORIES: { value: PantryCategory; label: string }[] = [
  { value: "protein", label: "Protein" },
  { value: "vegetable", label: "Vegetables" },
  { value: "fruit", label: "Fruit" },
  { value: "dairy", label: "Dairy & eggs" },
  { value: "grain", label: "Grains & bread" },
  { value: "frozen", label: "Frozen" },
  { value: "condiment", label: "Sauces & oils" },
  { value: "spice", label: "Spices" },
  { value: "beverage", label: "Drinks" },
  { value: "other", label: "Other" },
];

// ── Expiration (month/year) for long-lasting items ───────────────────────────

export const EXPIRY_CATEGORIES: PantryCategory[] = ["spice", "condiment", "frozen"];
export const FROZEN_MEAL_KEEPS_MONTHS = 3;
const EXPIRING_SOON_DAYS = 31;

/** Stored as the first of the month ("2027-03-01"); the item is good through the end of that month. */
export function expiryDate(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/** The expiry `months` calendar months after `from`, e.g. for freezer meals. */
export function expiryInMonths(from: Date, months: number): string {
  const d = new Date(from.getFullYear(), from.getMonth() + months, 1);
  return expiryDate(d.getFullYear(), d.getMonth() + 1);
}

export function formatExpiry(expiry: string): string {
  const [y, m] = expiry.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

export function expiryStatus(expiry: string, now: Date): "expired" | "soon" | "ok" {
  const [y, m] = expiry.split("-").map(Number);
  const lastDay = new Date(y, m, 0); // day 0 of the next month = last day of this one
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (today > lastDay) return "expired";
  const daysLeft = (lastDay.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
  return daysLeft <= EXPIRING_SOON_DAYS ? "soon" : "ok";
}

// Roughly the order you walk a grocery store: produce first, then proteins and dairy
export const STORE_CATEGORY_ORDER: PantryCategory[] = [
  "vegetable", "fruit", "protein", "dairy", "grain", "frozen", "condiment", "spice", "beverage", "other",
];

/** Whether something with this name is already on the list (same loose matching as the kitchen). */
export function isOnList(name: string, items: { name: string }[]): boolean {
  return findPantryMatch(name, items as PantryItem[]) !== null;
}

const CATEGORY_KEYWORDS: [PantryCategory, string[]][] = [
  ["protein", ["chicken", "turkey", "beef", "pork", "steak", "salmon", "tuna", "shrimp", "fish", "tofu", "tempeh", "chickpea", "lentil", "sausage", "bacon", "ham", "lamb", "cod", "tilapia"]],
  ["dairy", ["milk", "cheese", "yogurt", "butter", "cream", "egg", "feta", "parmesan", "mozzarella", "cheddar"]],
  ["vegetable", ["cucumber", "tomato", "lettuce", "spinach", "onion", "garlic", "pepper", "carrot", "broccoli", "zucchini", "kale", "celery", "mushroom", "potato", "cabbage", "cauliflower", "asparagu", "corn", "bean", "pea", "scallion", "shallot", "arugula", "eggplant"]],
  ["fruit", ["avocado", "lemon", "lime", "apple", "banana", "berry", "strawberry", "blueberry", "orange", "grape", "mango", "pineapple"]],
  ["grain", ["rice", "pasta", "bread", "panko", "flour", "quinoa", "tortilla", "oat", "noodle", "couscou", "pita", "breadcrumb"]],
  ["condiment", ["sauce", "broth", "stock", "oil", "vinegar", "mayo", "mayonnaise", "mustard", "ketchup", "soy", "honey", "hummu", "tahini", "salsa", "dressing", "sriracha"]],
  ["spice", ["salt", "cumin", "paprika", "oregano", "cinnamon", "chili", "basil", "thyme", "rosemary", "parsley", "cilantro", "dill", "turmeric"]],
];

export function guessCategory(name: string): PantryCategory {
  if (LEFTOVER_PATTERN.test(name) || /\bfrozen\b/i.test(name)) return "frozen";
  const tokens = ingredientTokens(name);
  // The last word usually names the item: "cherry tomatoes", "chicken breast"
  for (const token of [...tokens].reverse()) {
    for (const [category, words] of CATEGORY_KEYWORDS) {
      if (words.includes(token)) return category;
    }
  }
  return "other";
}
