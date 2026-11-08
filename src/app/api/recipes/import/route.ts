import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSessionIds } from "@/lib/get-owner-id";
import { SafeFetchError, fetchPublicHtml } from "@/lib/safe-fetch";
import { extractRecipe } from "@/lib/recipe-import";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  try {
    await getSessionIds(supabase);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const raw = typeof body?.url === "string" ? body.url.trim() : "";
  if (!raw || raw.length > 2048) {
    return NextResponse.json({ error: "Paste a recipe link to import." }, { status: 400 });
  }
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const { html } = await fetchPublicHtml(url);
    const recipe = extractRecipe(html);
    if (!recipe) {
      return NextResponse.json(
        { error: "Couldn't find a recipe on that page. You can still add it by hand." },
        { status: 422 }
      );
    }
    return NextResponse.json({ recipe });
  } catch (err) {
    if (err instanceof SafeFetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Recipe import failed:", err);
    return NextResponse.json({ error: "Couldn't import that recipe." }, { status: 500 });
  }
}
