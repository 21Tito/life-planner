export default function MealsLoading() {
  return (
    <div className="max-w-5xl animate-pulse">
      <div className="mb-5 lg:mb-6">
        <div className="h-9 w-44 bg-[var(--color-border)] rounded-lg mb-2" />
        <div className="h-4 w-72 max-w-full bg-[var(--color-border)] rounded" />
      </div>

      <div className="h-9 w-80 max-w-full bg-[var(--color-border)] rounded-xl mb-5 lg:mb-6" />

      <div className="h-5 w-40 bg-[var(--color-border)] rounded mb-4" />

      <div className="grid gap-3 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border border-[var(--color-border)] bg-white p-3 space-y-2">
            <div className="h-4 w-24 bg-[var(--color-border)] rounded" />
            <div className="h-10 bg-[var(--color-border)] rounded-lg" />
            <div className="h-7 bg-[var(--color-border)] rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
