export default function TripsLoading() {
  return (
    <div className="max-w-4xl animate-pulse">
      {/* Header row */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="h-9 w-36 bg-[var(--color-border)] rounded-lg mb-2" />
          <div className="h-4 w-64 bg-[var(--color-border)] rounded" />
        </div>
        <div className="h-10 w-28 bg-[var(--color-border)] rounded-full" />
      </div>

      {/* Trip cards */}
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--color-border)] bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-[var(--color-border)] flex-shrink-0" />
                <div className="space-y-2">
                  <div className="h-4 w-40 bg-[var(--color-border)] rounded" />
                  <div className="h-3 w-56 bg-[var(--color-border)] rounded" />
                </div>
              </div>
              <div className="h-6 w-16 bg-[var(--color-border)] rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
