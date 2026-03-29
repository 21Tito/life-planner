// Badge component

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "purple"

const variantStyles: Record<BadgeVariant, string> = {
  default:  "bg-[#F3F4F6] text-[#374151] border border-[#D1D5DB]",
  success:  "bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0]",
  warning:  "bg-[#FFFBEB] text-[#D97706] border border-[#FDE68A]",
  error:    "bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA]",
  info:     "bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]",
  purple:   "bg-[#F5F3FF] text-[#7C3AED] border border-[#DDD6FE]",
}

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  dot?: boolean
}

export function Badge({ children, variant = "default", dot = false }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold ${variantStyles[variant]}`}>
      {dot && (
        <span className="w-1.5 h-1.5 rounded-full bg-current" />
      )}
      {children}
    </span>
  )
}

// Category tag used for pantry items / labels
export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-brand-50)] text-[var(--color-brand-600)]">
      {children}
    </span>
  )
}

// Duration / stat pill (e.g. "5 days")
export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block px-2.5 py-1 rounded-full text-xs font-medium bg-[var(--color-brand-50)] text-[var(--color-brand-700)]">
      {children}
    </span>
  )
}
