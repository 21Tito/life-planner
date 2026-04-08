import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { HouseholdProvider } from "@/lib/household-context";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  // getSession() reads from the cookie instantly (no network round-trip),
  // giving us the user ID so we can fire the profile fetch in parallel
  // with getUser() which verifies the JWT with the auth server.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const [{ data: { user } }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("profiles").select("full_name, avatar_url").eq("id", session.user.id).single(),
  ]);

  if (!user) redirect("/login");

  const ownerId =
    (user.user_metadata?.household_owner_id as string | undefined) ?? user.id;

  return (
    <HouseholdProvider ownerId={ownerId}>
      <div className="flex min-h-screen">
        <Sidebar
          user={{
            id: user.id,
            email: user.email!,
            name: profile?.full_name ?? user.email!,
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
