export default function SettingsLoading() {
  return (
    <div className="max-w-xl animate-pulse">
      <div className="h-9 w-32 bg-[var(--color-border)] rounded-lg mb-2" />
      <div className="h-4 w-64 max-w-full bg-[var(--color-border)] rounded mb-8" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-xl border border-[var(--color-border)] bg-white p-5 mb-6 space-y-3">
          <div className="h-5 w-40 bg-[var(--color-border)] rounded" />
          <div className="h-4 w-full bg-[var(--color-border)] rounded" />
          <div className="h-9 w-32 bg-[var(--color-border)] rounded-full" />
        </div>
      ))}
    </div>
  );
}
