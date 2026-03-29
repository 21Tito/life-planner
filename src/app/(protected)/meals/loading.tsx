export default function MealsLoading() {
  return (
    <div className="max-w-5xl animate-pulse">
      {/* Heading */}
      <div className="h-9 w-40 bg-[var(--color-border)] rounded-lg mb-2" />
      <div className="h-4 w-80 bg-[var(--color-border)] rounded mb-8" />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)] pb-px">
        {[72, 56, 80].map((w, i) => (
          <div key={i} style={{ width: w }} className="h-9 bg-[var(--color-border)] rounded-t" />
        ))}
      </div>

      {/* Add item form */}
      <div className="flex gap-3 mb-6">
        <div className="flex-1 h-10 bg-[var(--color-border)] rounded-lg" />
        <div className="w-32 h-10 bg-[var(--color-border)] rounded-lg" />
        <div className="w-24 h-10 bg-[var(--color-border)] rounded-lg" />
        <div className="w-20 h-10 bg-[var(--color-border)] rounded-lg" />
      </div>

      {/* Item rows */}
      <div className="space-y-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-5 w-16 bg-[var(--color-border)] rounded-full" />
              <div className="h-4 w-32 bg-[var(--color-border)] rounded" />
            </div>
            <div className="h-4 w-14 bg-[var(--color-border)] rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
