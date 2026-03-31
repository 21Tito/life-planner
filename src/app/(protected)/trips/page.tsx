import { createClient } from "@/lib/supabase/server";
import { TripsClient } from "./trips-client";

export default async function TripsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false });

  return <TripsClient initialTrips={trips ?? []} />;
}
