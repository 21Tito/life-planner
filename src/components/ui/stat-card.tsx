import { Icons } from "@/components/ui/icons"

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ReactNode
  trend?: string
}

export function StatCard({ label, value, icon, trend }: StatCardProps) {
  return (
    <div className="flex justify-between items-start p-5 rounded-xl border border-border bg-card shadow-sm">
      <div>
        <div className="text-sm text-muted-foreground font-medium mb-1">{label}</div>
        <div className="text-3xl font-bold text-foreground leading-tight">{value}</div>
        {trend && (
          <div className="flex items-center gap-1 mt-1.5 text-xs font-medium text-primary">
            {Icons.trendUp}
            {trend}
          </div>
        )}
      </div>
      <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center text-primary/70">
        {icon}
      </div>
    </div>
  )
}
