/**
 * Extracts a recipe from a web page's schema.org JSON-LD, which most recipe
 * sites embed for search engines.
 */

export interface ImportedRecipe {
  title: string;
  ingredients: string[];
  instructions: string;
  notes: string | null;
}

const MAX_INGREDIENTS = 100;
const MAX_INSTRUCTIONS_CHARS = 20_000;

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", ndash: "–", mdash: "—",
  hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", deg: "°", frac12: "½",
  frac14: "¼", frac34: "¾", frac13: "⅓", frac23: "⅔", frac18: "⅛", times: "×", eacute: "é",
};

function decodeEntities(text: string): string {
  let out = text;
  // Some sites double-encode ("&amp;#39;"), so run twice
  for (let i = 0; i < 2 && out.includes("&"); i++) {
    out = out.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (match, code: string) => {
      if (code[0] === "#") {
        const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : match;
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? match;
    });
  }
  return out;
}

/** Strips tags, turning block-level breaks into newlines. */
function toPlainText(value: string): string {
  return decodeEntities(
    value
      .replace(/<\s*(br|\/p|\/li|\/div|\/h\d)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function oneLine(value: string): string {
  return toPlainText(value).replace(/\n/g, " ");
}

function isObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasType(node: JsonObject, type: string): boolean {
  const t = node["@type"];
  return t === type || (Array.isArray(t) && t.includes(type));
}

function findRecipeNode(node: Json | undefined, depth = 0): JsonObject | null {
  if (depth > 5 || node === undefined || node === null) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isObject(node)) return null;
  if (hasType(node, "Recipe")) return node;
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    const found = findRecipeNode(node[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function readJsonLdBlocks(html: string): Json[] {
  const blocks: Json[] = [];
  const pattern = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(pattern)) {
    const raw = match[1]
      .replace(/^\s*(<!--|\/\/\s*<!\[CDATA\[)/, "")
      .replace(/(-->|\/\/\s*\]\]>)\s*$/, "")
      .trim();
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Malformed block (common on some sites); skip it and keep looking
    }
  }
  return blocks;
}

function readIngredients(recipe: JsonObject): string[] {
  const raw = recipe.recipeIngredient ?? recipe.ingredients;
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split("\n") : [];
  return list
    .filter((i): i is string => typeof i === "string")
    .map(oneLine)
    .filter(Boolean)
    .slice(0, MAX_INGREDIENTS);
}

function stepText(step: Json): string {
  if (typeof step === "string") return toPlainText(step);
  if (isObject(step)) {
    const text = step.text ?? step.name ?? step.description;
    return typeof text === "string" ? toPlainText(text) : "";
  }
  return "";
}

/** Handles a plain string, a list of steps, or HowToSections containing steps. */
function readInstructions(recipe: JsonObject): string {
  const raw = recipe.recipeInstructions;
  if (typeof raw === "string") return toPlainText(raw);
  if (!Array.isArray(raw)) return isObject(raw) ? stepText(raw) : "";

  const lines: string[] = [];
  const pushSteps = (steps: Json[]) => {
    let n = 1;
    for (const step of steps) {
      const text = stepText(step).replace(/\n+/g, " ");
      if (text) lines.push(`${n++}. ${text.replace(/^\d+[.)]\s*/, "")}`);
    }
  };

  const sections = raw.filter((s) => isObject(s) && hasType(s, "HowToSection")) as JsonObject[];
  if (sections.length > 0) {
    for (const section of sections) {
      if (typeof section.name === "string" && section.name.trim()) {
        if (lines.length) lines.push("");
        lines.push(`${oneLine(section.name)}:`);
      }
      const steps = section.itemListElement;
      pushSteps(Array.isArray(steps) ? steps : steps ? [steps] : []);
    }
  } else {
    pushSteps(raw);
  }
  return lines.join("\n").slice(0, MAX_INSTRUCTIONS_CHARS);
}

/** "PT1H15M" → "1 hr 15 min" */
function formatDuration(iso: Json | undefined): string | null {
  if (typeof iso !== "string") return null;
  const m = iso.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  const hours = Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0);
  const minutes = Number(m[3] ?? 0);
  if (!hours && !minutes) return null;
  return [hours && `${hours} hr`, minutes && `${minutes} min`].filter(Boolean).join(" ");
}

function formatYield(raw: Json | undefined): string | null {
  const value = Array.isArray(raw) ? raw.find((v) => typeof v === "string" || typeof v === "number") : raw;
  if (typeof value === "number") return `Serves ${value}`;
  if (typeof value !== "string" || !value.trim()) return null;
  const text = oneLine(value);
  return /^\d+$/.test(text) ? `Serves ${text}` : text;
}

export function extractRecipe(html: string): ImportedRecipe | null {
  for (const block of readJsonLdBlocks(html)) {
    const recipe = findRecipeNode(block);
    if (!recipe) continue;

    const title = typeof recipe.name === "string" ? oneLine(recipe.name).slice(0, 200) : "";
    const ingredients = readIngredients(recipe);
    const instructions = readInstructions(recipe);
    if (!title && ingredients.length === 0) continue;

    const time = formatDuration(recipe.totalTime) ?? formatDuration(recipe.cookTime);
    const notes = [formatYield(recipe.recipeYield), time].filter(Boolean).join(" · ") || null;

    return { title, ingredients, instructions, notes };
  }
  return null;
}
