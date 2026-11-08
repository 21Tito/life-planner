import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { HouseholdProvider } from "@/lib/household-context";
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

  const [{ data: profile }, ownerId] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", userId).single(),
    getHouseholdOwnerId(supabase, userId),
  ]);

  return (
    <HouseholdProvider ownerId={ownerId}>
      <div className="flex min-h-screen">
        <Sidebar
          user={{
            id: userId,
            email,
            name: profile?.full_name ?? email,
            avatar: profile?.avatar_url ?? undefined,
          }}
        />
        {/* pt-14 clears mobile top header; pb-24 clears mobile bottom nav */}
        <main className="flex-1 min-w-0 px-4 pt-20 pb-24 lg:px-10 lg:py-8 lg:pt-8 lg:pb-8">
          {children}
        </main>
        <MobileNav />
      </div>
    </HouseholdProvider>
  );
}
