import { createClient } from "@/lib/supabase/server";
import { getVerifiedIds } from "@/lib/get-owner-id";
import { TripsClient } from "./trips-client";

export default async function TripsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; new?: string }>;
}) {
  const { tab, new: startNew } = await searchParams;
  const supabase = await createClient();
  const { ownerId } = await getVerifiedIds(supabase);

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  return (
    <TripsClient
      initialTrips={trips ?? []}
      initialTab={tab === "completed" && startNew !== "1" ? "completed" : "upcoming"}
      startWithNewTrip={startNew === "1"}
    />
  );
}
