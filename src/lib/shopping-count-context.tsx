"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ShoppingItem } from "@/types";

// How many items are left to buy, for the badge on the Shopping nav item.
// The layout loads it once; pages that hold the list keep it current.
const ShoppingCountContext = createContext<{ count: number; setCount: (count: number) => void }>({
  count: 0,
  setCount: () => {},
});

export function ShoppingCountProvider({
  initialCount,
  children,
}: {
  initialCount: number;
  children: React.ReactNode;
}) {
  const [count, setCount] = useState(initialCount);
  return (
    <ShoppingCountContext.Provider value={{ count, setCount }}>
      {children}
    </ShoppingCountContext.Provider>
  );
}

export function useShoppingCount(): number {
  return useContext(ShoppingCountContext).count;
}

/** Keeps the nav badge in step with a page's copy of the list (or a count it loaded). */
export function useSyncShoppingCount(items: ShoppingItem[] | number) {
  const { setCount } = useContext(ShoppingCountContext);
  const count = typeof items === "number" ? items : items.filter((i) => !i.checked).length;
  useEffect(() => setCount(count), [count, setCount]);
}
