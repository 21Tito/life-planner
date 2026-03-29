"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Icons } from "@/components/ui/icons";

const FEATURES = [
  {
    icon: Icons.clipboard,
    title: "Meal Planning",
    description: "AI builds a weekly meal plan from whatever's in your fridge.",
  },
  {
    icon: Icons.map,
    title: "Trip Itineraries",
    description: "Day-by-day plans tailored to your interests and budget.",
  },
  {
    icon: Icons.sparkle,
    title: "Powered by AI",
    description: "Claude generates smart, personalized suggestions every time.",
  },
];

export default function HomePage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) router.push("/dashboard");
    });
  }, []);

  async function signInWithGoogle() {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.error("Login error:", error);
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-surface)] flex flex-col">
      {/* Nav bar */}
      <nav className="border-b border-[var(--color-border)] bg-white px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-[var(--color-brand-600)] flex items-center justify-center text-white text-xs font-bold">
            LP
          </div>
          <span className="font-bold text-sm" style={{ fontFamily: "var(--font-display)" }}>
            Life Planner
          </span>
        </div>
        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="text-sm font-semibold text-[var(--color-brand-600)] hover:text-[var(--color-brand-700)] transition-colors disabled:opacity-50"
        >
          {loading ? "Redirecting..." : "Sign in"}
        </button>
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--color-brand-50)] text-[var(--color-brand-600)] text-xs font-semibold mb-6">
          <span className="text-[var(--color-brand-400)]">{Icons.sparkle}</span>
          AI-powered planning
        </div>

        <h1
          className="text-5xl sm:text-7xl font-bold tracking-tight text-[var(--color-text)] mb-6"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Life, planned.
        </h1>

        <p className="max-w-xl text-lg leading-8 text-[var(--color-text-muted)] mb-10">
          AI-powered meal planning from what&apos;s in your fridge, and trip
          itineraries that actually make sense. Your personal planner that
          learns what you like.
        </p>

        <button
          onClick={signInWithGoogle}
          disabled={loading}
          className="flex items-center justify-center gap-3 rounded-full border border-[var(--color-border)] bg-white px-8 py-3.5 text-sm font-semibold shadow-sm hover:shadow-md hover:border-[var(--color-brand-300)] transition-all disabled:opacity-50"
        >
          <svg className="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          {loading ? "Redirecting..." : "Continue with Google"}
        </button>
      </div>

      {/* Features */}
      <div className="border-t border-[var(--color-border)] bg-white px-6 py-16">
        <div className="max-w-4xl mx-auto grid gap-8 sm:grid-cols-3">
          {FEATURES.map(({ icon, title, description }) => (
            <div key={title} className="flex flex-col items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-50)] flex items-center justify-center text-[var(--color-brand-400)]">
                {icon}
              </div>
              <h3 className="font-semibold text-sm">{title}</h3>
              <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
