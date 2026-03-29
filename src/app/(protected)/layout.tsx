import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

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

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        user={{
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
  );
}
