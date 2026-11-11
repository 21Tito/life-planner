import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { HouseholdProvider } from "@/lib/household-context";
import { ShoppingCountProvider } from "@/lib/shopping-count-context";
import { getHouseholdOwnerId } from "@/lib/get-owner-id";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // Verified locally against the project's signing keys; no Auth server round trip
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/login");
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";

  const [{ data: profile }, { ownerId, toBuyCount }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", userId).single(),
    getHouseholdOwnerId(supabase, userId).then(async (ownerId) => {
      // For the badge on the Shopping nav item
      const { count } = await supabase
        .from("shopping_items")
        .select("id", { count: "exact", head: true })
        .eq("user_id", ownerId)
        .eq("checked", false);
      return { ownerId, toBuyCount: count ?? 0 };
    }),
  ]);

  return (
    <HouseholdProvider ownerId={ownerId}>
      <ShoppingCountProvider initialCount={toBuyCount}>
        <div className="flex min-h-screen">
          <Sidebar
            user={{
              id: userId,
              email,
              name: profile?.full_name ?? email,
              avatar: profile?.avatar_url ?? undefined,
            }}
          />
          {/* Mobile padding clears the fixed header and the floating nav, plus the phone's safe areas */}
          <main className="flex-1 min-w-0 px-4 pt-[calc(5rem_+_env(safe-area-inset-top))] pb-[calc(7rem_+_env(safe-area-inset-bottom))] lg:px-10 lg:py-8 lg:pt-8 lg:pb-8">
            {children}
          </main>
          <MobileNav />
        </div>
      </ShoppingCountProvider>
    </HouseholdProvider>
  );
}
