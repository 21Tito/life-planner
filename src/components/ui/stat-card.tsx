interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  trend?: string
}

export function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div className="flex justify-between items-start p-5 rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
      <div>
        <div className="text-sm text-[var(--color-text-muted)] font-medium mb-1">{label}</div>
        <div className="text-3xl font-bold text-[var(--color-text)] leading-tight">{value}</div>
        {trend && (
          <div className="flex items-center gap-1 mt-1.5 text-xs font-medium text-[var(--color-brand-600)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 10 L5 7 L7 9 L12 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {trend}
          </div>
        )}
      </div>
      <div className="w-10 h-10 rounded-lg bg-[var(--color-brand-50)] flex items-center justify-center text-[var(--color-brand-400)]">
        {icon}
      </div>
    </div>
  )
}
