import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { AcceptInviteClient } from "./accept-client";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const isValidToken = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(isValidToken ? `/login?redirect=/invite/${token}` : "/login");
  }

  // Invites aren't readable through RLS (the token is the secret), so look this one up server-side
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { data: invite } = isValidToken
    ? await admin.from("household_invites").select("owner_id").eq("token", token).maybeSingle()
    : { data: null };

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-xl font-bold mb-2">Invite not found</h1>
          <p className="text-muted-foreground text-sm">
            This invite link is invalid or has been revoked.
          </p>
        </div>
      </div>
    );
  }

  // Fetch owner profile for display
  const { data: ownerProfile } = await admin
    .from("profiles")
    .select("full_name")
    .eq("id", invite.owner_id)
    .single();

  // Already the owner
  if (user.id === invite.owner_id) {
    redirect("/settings");
  }

  // Already a member of this household
  const { data: existing } = await supabase
    .from("household_members")
    .select("owner_id")
    .eq("member_id", user.id)
    .eq("owner_id", invite.owner_id)
    .single();

  if (existing) {
    redirect("/dashboard");
  }

  return (
    <AcceptInviteClient
      token={token}
      ownerName={ownerProfile?.full_name ?? "Someone"}
    />
  );
}
