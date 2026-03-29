import { NextResponse } from "next/server";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mapsUrl = searchParams.get("url");

  if (!mapsUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  if (
    !/^https?:\/\/(maps\.app\.goo\.gl|maps\.google\.com|www\.google\.com\/maps)/.test(
      mapsUrl
    )
  ) {
    return NextResponse.json({ error: "Not a Google Maps URL" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(mapsUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });

    clearTimeout(timeout);

    // 1. Try to extract from the final (redirected) URL — fast, no HTML needed
    const nameFromUrl = extractNameFromUrl(response.url);
    if (nameFromUrl) {
      return NextResponse.json({ name: nameFromUrl });
    }

    // 2. Fall back to parsing the page HTML
    const html = await response.text();
    const nameFromHtml = extractNameFromHtml(html);
    if (nameFromHtml) {
      return NextResponse.json({ name: nameFromHtml });
    }

    return NextResponse.json(
      { error: "Could not extract place name" },
      { status: 422 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
