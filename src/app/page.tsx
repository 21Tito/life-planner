import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center">
        <h1
          className="text-5xl font-bold tracking-tight sm:text-7xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Life, planned.
        </h1>
        <p className="mt-6 text-lg leading-8 text-[var(--color-text-muted)]">
          AI-powered meal planning from what&apos;s in your fridge, and trip
          itineraries that actually make sense. Your personal planner that
          learns what you like.
        </p>
        <div className="mt-10 flex items-center justify-center gap-x-4">
          <Link
            href="/login"
            className="rounded-full bg-[var(--color-brand-600)] px-8 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[var(--color-brand-700)] transition-colors"
          >
            Get started
          </Link>
        </div>
      </div>
    </main>
  );
}
