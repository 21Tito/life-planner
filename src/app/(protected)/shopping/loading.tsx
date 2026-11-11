export default function ShoppingLoading() {
  return (
    <div className="max-w-2xl animate-pulse">
      <div className="h-10 w-40 bg-[var(--color-border)] rounded-lg mb-4" />
      <div className="h-[4.5rem] bg-[var(--color-border)] rounded-xl mb-6" />
      {[0, 1].map((g) => (
        <div key={g} className="mb-6">
          <div className="h-3 w-24 bg-[var(--color-border)] rounded mb-2" />
          <div className="rounded-xl border border-[var(--color-border)] bg-white divide-y divide-[var(--color-border)]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 px-4 flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-[var(--color-border)]" />
                <div className="h-4 w-32 bg-[var(--color-border)] rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
