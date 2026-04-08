import { createClient } from "@/lib/supabase/server";
import { getSessionIds } from "@/lib/get-owner-id";
import { MealsClient } from "./meals-client";

export default async function MealsPage() {
  const supabase = await createClient();
  const { ownerId } = await getSessionIds(supabase);

  const { data: items } = await supabase
    .from("grocery_list_items")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at");

  return <MealsClient initialItems={items ?? []} />;
}
