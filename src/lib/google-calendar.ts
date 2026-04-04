import { google } from "googleapis";
import { createServerClient } from "@supabase/ssr";

function getAdminSupabase() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!
  );
}

async function getCalendarClient(userId: string) {
  const supabase = getAdminSupabase();

  const { data: tokens } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!tokens) return null;

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });

  // Refresh token if expired or about to expire (within 5 minutes)
  const expiresAt = new Date(tokens.expires_at).getTime();
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    const { credentials } = await oauth2Client.refreshAccessToken();
    oauth2Client.setCredentials(credentials);

    await supabase
      .from("google_tokens")
      .update({
        access_token: credentials.access_token!,
        expires_at: new Date(credentials.expiry_date!).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
  }

  return google.calendar({ version: "v3", auth: oauth2Client });
}

export async function createCalendarEvent(
  userId: string,
  activity: {
    title: string;
    description: string | null;
    location: string | null;
    booking_url: string | null;
    start_time: string;
    end_time: string | null;
  },
  dayDate: string,
  timezone: string
): Promise<string | null> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return null;

  const startDateTime = `${dayDate}T${toHHMM(activity.start_time)}:00`;
  const endTime = activity.end_time ? toHHMM(activity.end_time) : incrementHour(toHHMM(activity.start_time));
  const endDateTime = `${dayDate}T${endTime}:00`;

  const event = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary: activity.title,
      description: activity.description || undefined,
      location: buildLocation(activity.location, activity.booking_url),
      start: { dateTime: startDateTime, timeZone: timezone },
      end: { dateTime: endDateTime, timeZone: timezone },
      reminders: {
        useDefault: false,
        overrides: [{ method: "popup", minutes: 30 }],
      },
    },
  });

  return event.data.id || null;
}

export async function updateCalendarEvent(
  userId: string,
  gcalEventId: string,
  activity: {
    title: string;
    description: string | null;
    location: string | null;
    booking_url: string | null;
    start_time: string;
    end_time: string | null;
  },
  dayDate: string,
  timezone: string
): Promise<void> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return;

  const startDateTime = `${dayDate}T${toHHMM(activity.start_time)}:00`;
  const endTime = activity.end_time ? toHHMM(activity.end_time) : incrementHour(toHHMM(activity.start_time));
  const endDateTime = `${dayDate}T${endTime}:00`;

  await calendar.events.patch({
    calendarId: "primary",
    eventId: gcalEventId,
    requestBody: {
      summary: activity.title,
      description: activity.description || undefined,
      location: buildLocation(activity.location, activity.booking_url),
      start: { dateTime: startDateTime, timeZone: timezone },
      end: { dateTime: endDateTime, timeZone: timezone },
    },
  });
}

export async function deleteCalendarEvent(
  userId: string,
  gcalEventId: string
): Promise<void> {
  const calendar = await getCalendarClient(userId);
  if (!calendar) return;

  await calendar.events.delete({
    calendarId: "primary",
    eventId: gcalEventId,
  });
}

// Combines text location and booking URL into a single location string for Google Calendar
function buildLocation(location: string | null, bookingUrl: string | null): string | undefined {
  if (location && bookingUrl) return `${location} · ${bookingUrl}`;
  if (bookingUrl) return bookingUrl;
  if (location) return location;
  return undefined;
}

// Postgres TIME columns return "HH:MM:SS" — strip seconds for datetime strings
function toHHMM(time: string): string {
  return time.slice(0, 5);
}

function incrementHour(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
