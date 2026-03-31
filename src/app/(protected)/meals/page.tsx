import { createClient } from "@/lib/supabase/server";
import { MealsClient } from "./meals-client";

export default async function MealsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: pantryItems } = await supabase
    .from("pantry_items")
    .select("*")
    .eq("user_id", user!.id)
    .order("category");

  return <MealsClient initialPantryItems={pantryItems ?? []} />;
}
