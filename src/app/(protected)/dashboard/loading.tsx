export default function DashboardLoading() {
  return (
    <div className="max-w-5xl animate-pulse">
      <div className="h-4 w-40 bg-[var(--color-border)] rounded mb-3" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="h-48 rounded-2xl bg-[var(--color-border)]" />
          <div className="h-80 rounded-2xl bg-[var(--color-border)]" />
        </div>
        <div className="space-y-3">
          <div className="h-[72px] rounded-2xl bg-[var(--color-border)]" />
          <div className="h-[72px] rounded-2xl bg-[var(--color-border)]" />
        </div>
      </div>
    </div>
  );
}
