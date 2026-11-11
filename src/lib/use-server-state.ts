"use client";

import { useState } from "react";

/**
 * useState seeded from server data that also takes newer server data when the page is
 * refreshed (router.refresh, e.g. after opening from a saved copy). Edits are saved to the
 * database as they're made, so the refreshed data already includes them.
 */
export function useServerState<T>(value: T): [T, React.Dispatch<React.SetStateAction<T>>];
export function useServerState<T, S>(value: T, prepare: (value: T) => S): [S, React.Dispatch<React.SetStateAction<S>>];
export function useServerState<T, S>(value: T, prepare?: (value: T) => S) {
  const toState = (v: T) => (prepare ? prepare(v) : (v as unknown as S));
  const [state, setState] = useState<S>(() => toState(value));
  const [from, setFrom] = useState(value);
  // A refresh delivers a new object; adopt it during render, as React recommends for derived state
  if (value !== from) {
    setFrom(value);
    setState(toState(value));
  }
  return [state, setState];
}
