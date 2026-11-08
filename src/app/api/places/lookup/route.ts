import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SafeFetchError, fetchPublicHtml } from "@/lib/safe-fetch";

function extractNameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);

    // /maps/place/Place+Name/@lat,lng,...
    const placeMatch = u.pathname.match(/\/maps\/place\/([^/@]+)/);
    if (placeMatch?.[1]) {
      const name = decodeURIComponent(placeMatch[1].replace(/\+/g, " ")).trim();
      if (name) return name;
    }

    // /maps/search/Query+Name/@...
    const searchMatch = u.pathname.match(/\/maps\/search\/([^/@]+)/);
    if (searchMatch?.[1]) {
      const name = decodeURIComponent(searchMatch[1].replace(/\+/g, " ")).trim();
      if (name) return name;
    }

    // ?q=Place+Name query param (older format)
    const q = u.searchParams.get("q");
    if (q) return q.trim();

    return null;
  } catch {
    return null;
  }
}

function extractNameFromHtml(html: string): string | null {
  // og:title is most reliable — "Place Name - Google Maps"
  const ogMatch = html.match(/property="og:title"\s+content="([^"]+)"/);
  if (ogMatch?.[1]) {
    const name = ogMatch[1].replace(/\s*[-–]\s*Google Maps$/, "").trim();
    if (name && name !== "Google Maps") return name;
  }

  // Reverse attribute order variant
  const ogMatch2 = html.match(/content="([^"]+)"\s+property="og:title"/);
  if (ogMatch2?.[1]) {
    const name = ogMatch2[1].replace(/\s*[-–]\s*Google Maps$/, "").trim();
    if (name && name !== "Google Maps") return name;
  }

  // <title> tag fallback
  const titleMatch = html.match(/<title[^>]*>([^<]+)/);
  if (titleMatch?.[1]) {
    const name = titleMatch[1].replace(/\s*[-–]\s*Google Maps$/, "").trim();
    if (name && name !== "Google Maps") return name;
  }

  return null;
}

/** Exact hostname (and path) check; a prefix match would accept maps.google.com.evil.com. */
function isGoogleMapsUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return false;
    if (url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    if (host === "maps.app.goo.gl" || host === "maps.google.com") return true;
    if (host === "goo.gl" || host === "www.google.com" || host === "google.com") {
      return url.pathname.startsWith("/maps");
    }
    return false;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mapsUrl = searchParams.get("url");

  if (!mapsUrl || mapsUrl.length > 2048) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  if (!isGoogleMapsUrl(mapsUrl)) {
    return NextResponse.json({ error: "Not a Google Maps URL" }, { status: 400 });
  }

  try {
    // Redirects are followed by the safe fetcher, which blocks private addresses on every hop
    const { html, finalUrl } = await fetchPublicHtml(mapsUrl, { timeoutMs: 6000, maxBytes: 3_000_000 });

    // 1. Try to extract from the final (redirected) URL — fast, no HTML needed
    const nameFromUrl = extractNameFromUrl(finalUrl);
    if (nameFromUrl) {
      return NextResponse.json({ name: nameFromUrl });
    }

    // 2. Fall back to parsing the page HTML
    const nameFromHtml = extractNameFromHtml(html);
    if (nameFromHtml) {
      return NextResponse.json({ name: nameFromHtml });
    }

    return NextResponse.json(
      { error: "Could not extract place name" },
      { status: 422 }
    );
  } catch (err) {
    if (err instanceof SafeFetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("Place lookup failed:", err);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
