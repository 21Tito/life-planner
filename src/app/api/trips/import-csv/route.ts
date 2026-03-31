import { createClient } from "@/lib/supabase/server";
import { getOwnerId } from "@/lib/get-owner-id";
import { NextResponse } from "next/server";
import type { ActivityCategory } from "@/types";

// Map CSV legend keywords to our activity categories
function guessCategory(text: string): ActivityCategory {
  const lower = text.toLowerCase();

  // Transport — check first since "arrive" and "depart" are strong signals
  if (
    lower.includes("flight") ||
    lower.includes("fly") ||
    lower.includes("airport") ||
    lower.includes("depart") ||
    lower.includes("arrive") ||
    lower.includes("train") ||
    lower.includes("rental car") ||
    lower.includes("pick up") ||
    lower.includes("drive to") ||
    lower.includes("drive back") ||
    lower.includes("transit") ||
    lower.includes("transfer") ||
    lower.includes("taxi") ||
    lower.includes("uber")
  )
    return "transport";

  // Hotel / accommodation
  if (
    lower.includes("hotel") ||
    lower.includes("check in") ||
    lower.includes("check-in") ||
    lower.includes("checkout") ||
    lower.includes("check out") ||
    lower.includes("airbnb") ||
    lower.includes("hostel") ||
    lower.includes("accommodation")
  )
    return "hotel";

  // Food — check before activity since restaurant names can contain activity words
  if (
    lower.includes("restaurant") ||
    lower.includes("dinner") ||
    lower.includes("lunch") ||
    lower.includes("brunch") ||
    lower.includes("breakfast") ||
    lower.includes("food") ||
    lower.includes("café") ||
    lower.includes("cafe") ||
    lower.includes("coffee") ||
    lower.includes("taberna") ||
    lower.includes("cervejaria") ||
    lower.includes("pastéis") ||
    lower.includes("pastel") ||
    lower.includes("francesinha") ||
    lower.includes("market") ||
    lower.includes("eat ") ||
    lower.includes("seafood") ||
    lower.includes("tapas") ||
    lower.includes("stall") ||
    lower.includes("bakery") ||
    lower.includes("reservation") ||
    lower.includes("reserved")
  )
    return "restaurant";

  // Shopping
  if (
    lower.includes("shopping") ||
    lower.includes("souvenir") ||
    lower.includes("bookshop") ||
    lower.includes("livraria") ||
    lower.includes("shop") ||
    lower.includes("boutique")
  )
    return "shopping";

  // Rest
  if (
    lower.includes("spa") ||
    lower.includes("relax") ||
    lower.includes("swim") ||
    lower.includes("pool") ||
    lower.includes("beach walk") ||
    lower.includes("rest")
  )
    return "rest";

  // Nightlife / entertainment — still categorized as "activity"
  if (
    lower.includes("bar") ||
    lower.includes("fado") ||
    lower.includes("drinks") ||
    lower.includes("rooftop") ||
    lower.includes("night walk") ||
    lower.includes("nightlife")
  )
    return "activity";

  // Sightseeing / default activity
  return "activity";
}

// Extract structured activity data from a cell's text
function parseActivityCell(cell: string): {
  title: string;
  description: string | null;
  location: string | null;
  booking_url: string | null;
} {
  const lines = cell.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { title: cell.trim(), description: null, location: null, booking_url: null };

  let title = lines[0];
  const descLines: string[] = [];
  let location: string | null = null;
  let booking_url: string | null = null;

  // Check ALL lines (including the title) for URLs
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const urlMatch = line.match(/(https?:\/\/[^\s),"]+)/);
    if (urlMatch && !booking_url) {
      booking_url = urlMatch[1];
      if (i === 0) {
        // URL is in the title line — strip it out so the title stays clean
        title = title.replace(urlMatch[0], "").replace(/\s{2,}/g, " ").trim();
      }
    }
    if (i > 0) descLines.push(line);
  }

  // If the entire title IS a URL (the cell was just a link), use the domain as title
  if (!title && booking_url) {
    try {
      title = new URL(booking_url).hostname.replace("www.", "");
    } catch {
      title = booking_url;
    }
  }

  // Clean up title: strip leading emoji/bullet markers like "📍 " or "🔸 "
  title = title.replace(/^[\u{1F300}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]\s*/u, "").trim();

  // If title starts with a category prefix like "Restaurant - ", "Dinner: ", "Lunch: ", extract as location hint
  const prefixMatch = title.match(
    /^(Restaurant|Dinner|Lunch|Breakfast|Brunch|Coffee|Check in|Check out|Sunset|Morning)\s*[-:–]\s*/i
  );
  if (prefixMatch) {
    // Keep the prefix context in the title but set the rest as location
    const afterPrefix = title.slice(prefixMatch[0].length).trim();
    if (afterPrefix) {
      location = afterPrefix.split(/\s*[-–(]\s*/)[0].trim();
    }
  } else {
    // Try to extract a location/place name from the title
    // Many entries are just place names which serve as both title and location
    location = title.split(/\s*[-–]\s*/)[0].trim();
    // Don't set location if it's the same as the full title (not useful)
    if (location === title) location = null;
  }

  return {
    title,
    description: descLines.length > 0 ? descLines.join("\n") : null,
    location,
    booking_url,
  };
}

// Try to extract a specific time from cell text for overflow rows
// Matches patterns like "7PM", "6:30PM", "at 9:30AM", "RESERVED 7PM", "@ 9:30AM"
function extractTimeFromText(text: string): { start: string; end: string } | null {
  const match = text.match(
    /(?:at |@ |RESERVED?\s*|RESERVATION\s*)(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i
  );
  if (!match) return null;
  let hour = parseInt(match[1]);
  const minutes = match[2] ? parseInt(match[2]) : 0;
  const ampm = match[3].toUpperCase();
  if (ampm === "PM" && hour < 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;
  const start = `${String(hour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  const endHour = hour + 1;
  const end = `${String(endHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return { start, end };
}

// Parse a CSV line respecting quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Parse date strings like "Fri, Apr 17, 2026"
function parseDateStr(dateStr: string): string | null {
  const cleaned = dateStr.replace(/^[A-Za-z]+,\s*/, "");
  const d = new Date(cleaned + " 00:00:00");
  if (isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ownerId = await getOwnerId(supabase, user.id);

    const { csv, title, destination } = await request.json();

    if (!csv) {
      return NextResponse.json({ error: "csv is required" }, { status: 400 });
    }

    // Parse CSV into rows
    const lines = (csv as string)
      .split("\n")
      .map((l: string) => l.replace(/\r$/, ""));
    const rows = lines.map(parseCSVLine);

    // Find key rows by their first-column label
    let cityRow: string[] = [];
    let hotelRow: string[] = [];
    let dateRow: string[] = [];
    const timeRows: { hour: string; cells: string[] }[] = [];
    const extraRows: string[][] = [];

    let pastTimeGrid = false;

    for (const row of rows) {
      const label = row[0]?.toLowerCase().trim();

      if (label === "city") {
        cityRow = row;
      } else if (label === "hotel") {
        hotelRow = row;
      } else if (label === "date") {
        dateRow = row;
      } else if (/^\d{1,2}:\d{2}$/.test(label)) {
        pastTimeGrid = true;
        timeRows.push({ hour: label, cells: row });
      } else if (pastTimeGrid && row.some((c) => c.trim())) {
        // Rows after the time grid with content are overflow/extra activities
        extraRows.push(row);
      }
    }

    if (dateRow.length < 2) {
      return NextResponse.json(
        { error: "Could not find a Date row in the CSV" },
        { status: 400 }
      );
    }

    // Build day info (skip col 0 which is the label)
    const dayCount = dateRow.length - 1;
    const dates: (string | null)[] = [];
    for (let i = 1; i <= dayCount; i++) {
      dates.push(parseDateStr(dateRow[i] ?? ""));
    }

    // Filter to only columns that have a valid date
    const validIndices = dates
      .map((d, i) => (d ? i : -1))
      .filter((i) => i >= 0);
    if (validIndices.length === 0) {
      return NextResponse.json(
        { error: "No valid dates found in the Date row" },
        { status: 400 }
      );
    }

    const startDate = dates[validIndices[0]]!;
    const endDate = dates[validIndices[validIndices.length - 1]]!;

    const tripTitle =
      title || destination
        ? `${destination || "Imported"} Trip`
        : "Imported Trip";
    const tripDestination = destination || "Imported";

    // Create trip
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .insert({
        user_id: ownerId,
        title: tripTitle,
        destination: tripDestination,
        start_date: startDate,
        end_date: endDate,
      })
      .select()
      .single();

    if (tripError) throw tripError;

    // Create days
    const daysToInsert = validIndices.map((colIdx, dayIdx) => ({
      trip_id: trip.id,
      user_id: ownerId,
      day_number: dayIdx + 1,
      date: dates[colIdx]!,
      title: cityRow[colIdx + 1]?.trim() || null,
      notes: hotelRow[colIdx + 1]?.trim() || null,
    }));

    const { data: createdDays, error: daysError } = await supabase
      .from("trip_days")
      .insert(daysToInsert)
      .select();

    if (daysError) throw daysError;

    // Build activities from time rows
    const activitiesToInsert: {
      trip_day_id: string;
      user_id: string;
      title: string;
      description: string | null;
      category: ActivityCategory;
      start_time: string | null;
      end_time: string | null;
      location: string | null;
      cost_cents: number | null;
      booking_url: string | null;
      sort_order: number;
    }[] = [];

    // Map column index -> created day id
    const colToDayId: Record<number, string> = {};
    validIndices.forEach((colIdx, i) => {
      colToDayId[colIdx] = createdDays[i].id;
    });

    // Track sort order per day
    const sortOrders: Record<string, number> = {};
    for (const day of createdDays) {
      sortOrders[day.id] = 0;
    }

    // Process time-grid activities with multi-hour span detection.
    // When Google Sheets exports merged cells, the content appears in the
    // first row and subsequent rows are empty. We scan forward to find how
    // many consecutive empty rows follow for each column to determine the
    // true duration of each activity.

    // Track which (timeRowIndex, colIdx) slots are "consumed" by a prior
    // multi-hour activity so we don't double-create.
    const consumed = new Set<string>();

    for (let t = 0; t < timeRows.length; t++) {
      const { hour, cells } = timeRows[t];
      const [h] = hour.split(":").map(Number);
      const startTime = `${String(h).padStart(2, "0")}:00`;

      for (const colIdx of validIndices) {
        const cellIdx = colIdx + 1;
        const key = `${t}:${colIdx}`;
        if (consumed.has(key)) continue;

        const cell = cells[cellIdx]?.trim();
        if (!cell) continue;

        // Scan forward: count how many consecutive time rows have an empty
        // cell in this same column. That tells us the merged-cell span.
        let spanEnd = t + 1;
        while (spanEnd < timeRows.length) {
          const nextCell = timeRows[spanEnd].cells[cellIdx]?.trim();
          if (nextCell) break; // hit the next activity
          consumed.add(`${spanEnd}:${colIdx}`);
          spanEnd++;
        }

        // End time = the hour at spanEnd (or fallback to start + 1)
        let endTime: string;
        if (spanEnd < timeRows.length) {
          const [eh] = timeRows[spanEnd].hour.split(":").map(Number);
          endTime = `${String(eh).padStart(2, "0")}:00`;
        } else {
          // Last block — end 1 hour after the last consumed row
          const [lh] = timeRows[spanEnd - 1].hour.split(":").map(Number);
          endTime = `${String(lh + 1).padStart(2, "0")}:00`;
        }

        const dayId = colToDayId[colIdx];
        const parsed = parseActivityCell(cell);

        activitiesToInsert.push({
          trip_day_id: dayId,
          user_id: ownerId,
          title: parsed.title,
          description: parsed.description,
          category: guessCategory(cell),
          start_time: startTime,
          end_time: endTime,
          location: parsed.location,
          cost_cents: null,
          booking_url: parsed.booking_url,
          sort_order: sortOrders[dayId]++,
        });
      }
    }

    // Process extra rows (activities listed below the time grid)
    for (const row of extraRows) {
      for (const colIdx of validIndices) {
        const cellIdx = colIdx + 1;
        const cell = row[cellIdx]?.trim();
        if (!cell) continue;

        const dayId = colToDayId[colIdx];
        const parsed = parseActivityCell(cell);
        const extractedTime = extractTimeFromText(cell);

        activitiesToInsert.push({
          trip_day_id: dayId,
          user_id: ownerId,
          title: parsed.title,
          description: parsed.description,
          category: guessCategory(cell),
          start_time: extractedTime?.start ?? null,
          end_time: extractedTime?.end ?? null,
          location: parsed.location,
          cost_cents: null,
          booking_url: parsed.booking_url,
          sort_order: sortOrders[dayId]++,
        });
      }
    }

    // Insert all activities in batches (Supabase has limits)
    if (activitiesToInsert.length > 0) {
      const BATCH_SIZE = 50;
      for (let i = 0; i < activitiesToInsert.length; i += BATCH_SIZE) {
        const batch = activitiesToInsert.slice(i, i + BATCH_SIZE);
        const { error: actError } = await supabase
          .from("trip_activities")
          .insert(batch);
        if (actError) throw actError;
      }
    }

    return NextResponse.json({
      trip,
      stats: {
        days: createdDays.length,
        activities: activitiesToInsert.length,
      },
    });
  } catch (error) {
    console.error("CSV import error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to import CSV",
      },
      { status: 500 }
    );
  }
}
