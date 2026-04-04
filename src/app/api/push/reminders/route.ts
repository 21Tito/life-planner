import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { activity_id, remind_minutes_before, activity_date, activity_time } =
    await request.json();

  if (!activity_date || !activity_time) {
    return NextResponse.json(
      { error: "Activity must have a date and start time to set a reminder" },
      { status: 400 }
    );
  }

  // Compute remind_at: activity datetime minus the offset
  const activityDateTime = new Date(`${activity_date}T${activity_time}`);
  const remindAt = new Date(
    activityDateTime.getTime() - remind_minutes_before * 60 * 1000
  );

  const { data, error } = await supabase
    .from("trip_reminders")
    .upsert(
      {
        user_id: user.id,
        activity_id,
        remind_at: remindAt.toISOString(),
        remind_minutes_before,
        sent: false,
      },
      { onConflict: "activity_id,remind_minutes_before" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { activity_id } = await request.json();

  const { error } = await supabase
    .from("trip_reminders")
    .delete()
    .eq("user_id", user.id)
    .eq("activity_id", activity_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
