import type {
  MealPlanEntry,
  PantryCategory,
  PantryItem,
  RecipeIngredient,
  RecipeWithIngredients,
} from "@/types";

export const PLANNED_WEEKDAYS = 5; // Monday–Friday
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

export function startOfWeek(d: Date): Date {
  const daysSinceMonday = (d.getDay() + 6) % 7;
  return addDays(d, -daysSinceMonday);
}

export function weekDates(weekStart: Date): Date[] {
  return Array.from({ length: PLANNED_WEEKDAYS }, (_, i) => addDays(weekStart, i));
}

export function daysSince(iso: string, now = new Date()): number {
  return Math.floor((now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
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

// ── Matching recipe ingredients against the fridge ───────────────────────────

const IGNORED_WORDS = new Set([
  "fresh", "chopped", "diced", "minced", "sliced", "shredded", "grated", "crushed",
  "peeled", "cubed", "large", "medium", "small", "boneless", "skinless", "organic",
  "finely", "roughly", "thinly", "optional", "divided", "can", "canned", "jar",
  "package", "of", "a", "an", "the", "and", "or", "to", "taste", "for",
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

/** "Boneless chicken breasts, cubed (about 2)" → ["chicken", "breast"] */
export function ingredientTokens(name: string): string[] {
  const core = name.toLowerCase().split(",")[0].replace(/\([^)]*\)/g, " ");
  return core
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && !IGNORED_WORDS.has(w))
    .map(singular);
}

function tokensMatch(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const setA = new Set(a);
  const setB = new Set(b);
  return a.every((t) => setB.has(t)) || b.every((t) => setA.has(t));
}

export function findPantryMatch(name: string, pantry: PantryItem[]): PantryItem | null {
  const tokens = ingredientTokens(name);
  return pantry.find((p) => tokensMatch(tokens, ingredientTokens(p.name))) ?? null;
}

/** "(15 oz) can chickpeas, drained" → "chickpeas", for the shopping list and fridge. */
export function shoppingName(name: string): string {
  const core = name.split(",")[0].replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const words = core.split(" ");
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

/** Combines the week's recipe ingredients and marks the ones already in the fridge. */
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

// ── Fridge categories ────────────────────────────────────────────────────────

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

const CATEGORY_KEYWORDS: [PantryCategory, string[]][] = [
  ["protein", ["chicken", "turkey", "beef", "pork", "steak", "salmon", "tuna", "shrimp", "fish", "tofu", "tempeh", "chickpea", "lentil", "sausage", "bacon", "ham", "lamb", "cod", "tilapia"]],
  ["dairy", ["milk", "cheese", "yogurt", "butter", "cream", "egg", "feta", "parmesan", "mozzarella", "cheddar"]],
  ["vegetable", ["cucumber", "tomato", "lettuce", "spinach", "onion", "garlic", "pepper", "carrot", "broccoli", "zucchini", "kale", "celery", "mushroom", "potato", "cabbage", "cauliflower", "asparagu", "corn", "bean", "pea", "scallion", "shallot", "arugula", "eggplant"]],
  ["fruit", ["avocado", "lemon", "lime", "apple", "banana", "berry", "strawberry", "blueberry", "orange", "grape", "mango", "pineapple"]],
  ["grain", ["rice", "pasta", "bread", "panko", "flour", "quinoa", "tortilla", "oat", "noodle", "couscou", "pita", "breadcrumb"]],
  ["condiment", ["sauce", "oil", "vinegar", "mayo", "mayonnaise", "mustard", "ketchup", "soy", "honey", "hummu", "tahini", "salsa", "dressing", "sriracha"]],
  ["spice", ["salt", "cumin", "paprika", "oregano", "cinnamon", "chili", "basil", "thyme", "rosemary", "parsley", "cilantro", "dill", "turmeric"]],
];

export function guessCategory(name: string): PantryCategory {
  const tokens = ingredientTokens(name);
  // The last word usually names the item: "cherry tomatoes", "chicken breast"
  for (const token of [...tokens].reverse()) {
    for (const [category, words] of CATEGORY_KEYWORDS) {
      if (words.includes(token)) return category;
    }
  }
  return "other";
}
