import { createClient } from "@/lib/supabase/server";
import { adminClient } from "@/lib/oauth";

export const dynamic = "force-dynamic";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground text-xl font-bold mx-auto mb-6">
          LP
        </div>
        {children}
      </div>
    </main>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <Shell>
      <h1 className="text-xl font-bold text-center mb-2">Can&apos;t connect</h1>
      <p className="text-sm text-muted-foreground text-center">{message}</p>
    </Shell>
  );
}

export default async function ConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ request?: string }>;
}) {
  const { request: requestId } = await searchParams;
  if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return <Problem message="This link is invalid. Start connecting again from Claude." />;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <Problem message="You're signed out. Start connecting again from Claude." />;

  const { data: pending } = await adminClient()
    .from("oauth_authorization_requests")
    .select("id, oauth_clients!inner(client_name)")
    .eq("id", requestId)
    .eq("user_id", user.id)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (!pending) return <Problem message="This request expired. Start connecting again from Claude." />;

  const client = (Array.isArray(pending.oauth_clients) ? pending.oauth_clients[0] : pending.oauth_clients) as
    | { client_name: string | null }
    | undefined;
  const appName = client?.client_name || "Claude";

  return (
    <Shell>
      <h1 className="text-xl font-bold text-center mb-1">Connect {appName} to Life Planner</h1>
      <p className="text-sm text-muted-foreground text-center mb-6">Signed in as {user.email}</p>

      <div className="rounded-xl ring-1 ring-foreground/10 bg-card p-4 text-sm space-y-3 mb-4">
        <p className="font-medium">{appName} will be able to:</p>
        <ul className="space-y-1.5 text-muted-foreground list-disc pl-5">
          <li>See your fridge, recipes, and meal plan</li>
          <li>Save new recipes</li>
          <li>Add meals to your weekly plan</li>
        </ul>
        <p className="text-muted-foreground">
          It can&apos;t delete anything or see your trips. You can disconnect anytime in Settings.
        </p>
      </div>

      <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-6">
        Only approve if you just started connecting Life Planner from Claude yourself.
      </p>

      <form method="POST" action="/api/oauth/decision" className="flex gap-2">
        <input type="hidden" name="request_id" value={pending.id} />
        <button
          type="submit"
          name="decision"
          value="deny"
          className="flex-1 px-4 py-2.5 text-sm rounded-lg border border-border font-medium hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          name="decision"
          value="allow"
          className="flex-1 px-4 py-2.5 text-sm rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity"
        >
          Allow
        </button>
      </form>
    </Shell>
  );
}
