import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";

webpush.setVapidDetails(
  "mailto:noreply@life-planner.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized calls
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Use service role to bypass RLS — this runs as a cron job, not a user
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );

  // Find all unsent reminders that are due
  const { data: dueReminders, error: fetchError } = await supabase
    .from("trip_reminders")
    .select(
      "*, trip_activities(title, start_time, category, trip_days(date, trips(title, destination)))"
    )
    .eq("sent", false)
    .lte("remind_at", new Date().toISOString());

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!dueReminders?.length) {
    return NextResponse.json({ sent: 0 });
  }

  let sentCount = 0;

  for (const reminder of dueReminders) {
    // Get all push subscriptions for this user
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", reminder.user_id);

    if (!subscriptions?.length) continue;

    const activity = reminder.trip_activities as {
      title: string;
      start_time: string | null;
      category: string;
      trip_days: {
        date: string;
        trips: { title: string; destination: string };
      };
    };

    const timeLabel = activity.start_time
      ? ` at ${formatTime(activity.start_time)}`
      : "";

    const tripTitle =
      activity.trip_days?.trips?.title || "your trip";

    const payload = JSON.stringify({
      title: `Upcoming: ${activity.title}`,
      body: `${activity.title}${timeLabel} — ${tripTitle}`,
      tag: `reminder-${reminder.id}`,
      url: "/trips",
    });

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        );
      } catch (err: unknown) {
        // If subscription is expired/invalid, clean it up
        if (err && typeof err === "object" && "statusCode" in err) {
          const pushErr = err as { statusCode: number };
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await supabase
              .from("push_subscriptions")
              .delete()
              .eq("id", sub.id);
          }
        }
      }
    }

    // Mark reminder as sent
    await supabase
      .from("trip_reminders")
      .update({ sent: true })
      .eq("id", reminder.id);

    sentCount++;
  }

  return NextResponse.json({ sent: sentCount });
}

function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}
