import { createClient } from "@/lib/supabase/server";
import { getOwnerId } from "@/lib/get-owner-id";
import { MealsClient } from "./meals-client";

export default async function MealsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const ownerId = await getOwnerId(supabase, user!.id);

  const { data: pantryItems } = await supabase
    .from("pantry_items")
    .select("*")
    .eq("user_id", ownerId)
    .order("category");

  return <MealsClient initialPantryItems={pantryItems ?? []} />;
}
