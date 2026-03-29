import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  className?: string
}

export function EmptyState({ icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn("text-center py-16 text-muted-foreground", className)}>
      <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-primary/60 mx-auto mb-3">
        {icon}
      </div>
      <p className="font-medium text-foreground">{title}</p>
      <p className="text-sm mt-1">{description}</p>
    </div>
  )
}
