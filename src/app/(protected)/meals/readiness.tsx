import { readinessLabel, type Readiness } from "@/lib/meals";
import { cn } from "@/lib/utils";

export function ReadinessText({
  readiness,
  showUnready,
  className,
}: {
  readiness: Readiness;
  showUnready?: boolean;
  className?: string;
}) {
  if (!readiness.status && !showUnready) return null;

  const label = readiness.status
    ? readinessLabel(readiness)
    : readiness.basedOnEssentials
      ? `Missing ${readiness.missing.length} essentials`
      : `Have ${readiness.have} of ${readiness.total}`;

  return (
    <p
      className={cn(
        "text-xs font-medium truncate",
        readiness.status === "ready" && "text-green-700",
        readiness.status === "almost" && "text-amber-700",
        !readiness.status && "text-muted-foreground",
        className
      )}
      title={readiness.missing.length ? `Missing: ${readiness.missing.join(", ")}` : undefined}
    >
      {label}
    </p>
  );
}

export function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
