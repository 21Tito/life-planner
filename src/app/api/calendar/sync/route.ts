import { createClient } from "@/lib/supabase/server";
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "@/lib/google-calendar";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { action, activity_id, day_date, gcal_event_id, timezone } =
    await request.json();

  const tz = timezone || "America/New_York";

  try {
    if (action === "delete") {
      if (gcal_event_id) {
        await deleteCalendarEvent(user.id, gcal_event_id);
      }
      return NextResponse.json({ synced: true });
    }

    // For create/update, fetch the activity
    const { data: activity } = await supabase
      .from("trip_activities")
      .select("*")
      .eq("id", activity_id)
      .single();

    if (!activity || !activity.start_time) {
      return NextResponse.json({ synced: false, reason: "no_start_time" });
    }

    const activityData = {
      title: activity.title,
      description: activity.description,
      location: activity.location,
      booking_url: activity.booking_url,
      start_time: activity.start_time,
      end_time: activity.end_time,
    };

    if (action === "update" && activity.gcal_event_id) {
      await updateCalendarEvent(
        user.id,
        activity.gcal_event_id,
        activityData,
        day_date,
        tz
      );
      return NextResponse.json({ synced: true });
    }

    // Create new event
    const eventId = await createCalendarEvent(
      user.id,
      activityData,
      day_date,
      tz
    );

    if (eventId) {
      await supabase
        .from("trip_activities")
        .update({ gcal_event_id: eventId })
        .eq("id", activity_id);
    }

    return NextResponse.json({ synced: !!eventId, gcal_event_id: eventId });
  } catch (err) {
    console.error("Calendar sync error:", err);
    return NextResponse.json({ synced: false, reason: "api_error" });
  }
}
