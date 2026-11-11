import type { ShoppingCategory } from "@/types";
import { Icons } from "./icons";

const svg = (children: React.ReactNode) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

/** A small colored line icon per kitchen/shopping category, in the style of the freezer snowflake */
const CATEGORY_ICONS: Record<ShoppingCategory, { icon: React.ReactNode; color: string }> = {
  protein: {
    color: "text-amber-700 dark:text-amber-500",
    icon: svg(
      <>
        <path d="M15.4 15.63a7.875 6 135 1 1 6.23-6.23 4.5 3.43 135 0 0-6.23 6.23" />
        <path d="m8.29 12.71-2.6 2.6a2.5 2.5 0 1 0-1.65 4.65A2.5 2.5 0 1 0 8.7 18.3l2.59-2.59" />
      </>
    ),
  },
  vegetable: {
    color: "text-green-600 dark:text-green-500",
    icon: svg(
      <>
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
      </>
    ),
  },
  fruit: {
    color: "text-red-500",
    icon: svg(
      <>
        <path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
        <path d="M10 2c1 .5 2 2 2 5" />
      </>
    ),
  },
  dairy: {
    color: "text-indigo-500 dark:text-indigo-400",
    icon: svg(
      <>
        <path d="M8 2h8" />
        <path d="M9 2v2.789a4 4 0 0 1-.672 2.219l-.656.984A4 4 0 0 0 7 10.212V20a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-9.789a4 4 0 0 0-.672-2.219l-.656-.984A4 4 0 0 1 15 4.788V2" />
        <path d="M7 15a6.472 6.472 0 0 1 5 0 6.47 6.47 0 0 0 5 0" />
      </>
    ),
  },
  grain: {
    color: "text-yellow-600 dark:text-yellow-500",
    icon: svg(
      <>
        <path d="M2 22 16 8" />
        <path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
        <path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
        <path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
        <path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z" />
        <path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
        <path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
        <path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
      </>
    ),
  },
  frozen: { color: "text-sky-600 dark:text-sky-400", icon: Icons.snowflake },
  condiment: {
    color: "text-lime-600 dark:text-lime-500",
    icon: svg(
      <>
        <path d="M10 2h4" />
        <path d="M10 2v4L8 9v11a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V9l-2-3V2" />
        <path d="M8 13h8" />
      </>
    ),
  },
  spice: {
    color: "text-orange-500",
    icon: svg(
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    ),
  },
  beverage: {
    color: "text-fuchsia-500 dark:text-fuchsia-400",
    icon: svg(
      <>
        <path d="m6 8 1.75 12.28a2 2 0 0 0 2 1.72h4.54a2 2 0 0 0 2-1.72L18 8" />
        <path d="M5 8h14" />
        <path d="M7 15a6.47 6.47 0 0 1 5 0 6.47 6.47 0 0 0 5 0" />
        <path d="m12 8 1-6h2" />
      </>
    ),
  },
  household: {
    color: "text-teal-600 dark:text-teal-400",
    icon: svg(
      <>
        <path d="M3 3h.01" />
        <path d="M7 5h.01" />
        <path d="M11 7h.01" />
        <path d="M3 7h.01" />
        <path d="M7 9h.01" />
        <path d="M3 11h.01" />
        <rect width="4" height="4" x="15" y="5" />
        <path d="m19 9 2 2v10c0 .6-.4 1-1 1h-6c-.6 0-1-.4-1-1V11l2-2" />
        <path d="m13 14 8-2" />
        <path d="m13 19 8-2" />
      </>
    ),
  },
  other: {
    color: "text-muted-foreground",
    icon: svg(
      <>
        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
        <path d="M3 6h18" />
        <path d="M16 10a4 4 0 0 1-8 0" />
      </>
    ),
  },
};

export function CategoryIcon({ category }: { category: ShoppingCategory }) {
  const { icon, color } = CATEGORY_ICONS[category];
  return <span className={`inline-flex flex-shrink-0 ${color}`}>{icon}</span>;
}

/** Section heading for a group of kitchen or shopping items */
export function CategoryHeading({ category, label }: { category: ShoppingCategory; label: string }) {
  return (
    <h2 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      <CategoryIcon category={category} />
      {label}
    </h2>
  );
}
