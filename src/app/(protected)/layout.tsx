import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { HouseholdProvider } from "@/lib/household-context";
import { getOwnerId } from "@/lib/get-owner-id";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, ownerId] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    getOwnerId(supabase, user.id),
  ]);

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
        <main className="flex-1 px-4 pt-20 pb-24 lg:px-10 lg:py-8 lg:pt-8 lg:pb-8">
          {children}
        </main>
        <MobileNav />
      </div>
    </HouseholdProvider>
  );
}
