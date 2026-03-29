"use client";

import { createContext, useContext } from "react";

// Stores the "effective owner" user ID.
// If the logged-in user is a member of someone else's household, this is the
// owner's ID. Otherwise it's the logged-in user's own ID.
const HouseholdContext = createContext<string>("");

export function HouseholdProvider({
  ownerId,
  children,
}: {
  ownerId: string;
  children: React.ReactNode;
}) {
  return (
    <HouseholdContext.Provider value={ownerId}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useOwnerId(): string {
  return useContext(HouseholdContext);
}
