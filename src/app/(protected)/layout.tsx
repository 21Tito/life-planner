import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";

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
      <main className="flex-1 px-6 py-8 lg:px-10">{children}</main>
    </div>
  );
}
