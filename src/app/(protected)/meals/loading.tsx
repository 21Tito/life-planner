export default function MealsLoading() {
  return (
    <div className="max-w-5xl animate-pulse">
      <div className="h-11 w-full lg:w-96 bg-[var(--color-border)] rounded-xl mb-4 lg:mb-6" />
      <div className="h-8 w-48 bg-[var(--color-border)] rounded-lg mb-4" />
      <div className="grid gap-3 lg:grid-cols-4 xl:grid-cols-7">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
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
