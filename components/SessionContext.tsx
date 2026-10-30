"use client";
// Makes the logged-in user available to client pages, e.g. to hide admin-only
// buttons. Hiding is only for convenience: the API still enforces roles.
import { createContext, useContext } from "react";
import type { Session } from "@/lib/session";

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ user, children }: { user: Session; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useUser() {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useUser must be used inside SessionProvider");
  return { ...user, isAdmin: user.role === "ADMIN" };
}
