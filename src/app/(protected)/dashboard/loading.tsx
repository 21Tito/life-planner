export default function DashboardLoading() {
  return (
    <div className="max-w-4xl animate-pulse">
      {/* Heading */}
      <div className="h-9 w-48 bg-[var(--color-border)] rounded-lg mb-2" />
      <div className="h-4 w-72 bg-[var(--color-border)] rounded mb-8" />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-10">
        {[0, 1].map((i) => (
          <div key={i} className="flex justify-between items-start p-5 rounded-xl border border-[var(--color-border)] bg-white">
            <div className="space-y-2">
              <div className="h-3 w-20 bg-[var(--color-border)] rounded" />
              <div className="h-8 w-10 bg-[var(--color-border)] rounded" />
            </div>
            <div className="w-10 h-10 rounded-lg bg-[var(--color-border)]" />
          </div>
        ))}
      </div>

      {/* Section label */}
      <div className="h-3 w-28 bg-[var(--color-border)] rounded mb-4" />

      {/* Feature cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--color-border)] bg-white p-6">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-border)] mb-4" />
            <div className="h-4 w-32 bg-[var(--color-border)] rounded mb-2" />
            <div className="h-3 w-full bg-[var(--color-border)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
