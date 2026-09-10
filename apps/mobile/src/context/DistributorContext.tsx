import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { DistributorSummary } from "@flowmint/shared";

// In-memory only, like CartContext — reset on logout, re-picked on next
// login. Not persisted: switching distributors is meant to be a deliberate,
// visible action (see TodayBeatScreen's "Switch" link), not something that
// silently survives an app restart onto stale state.
interface DistributorState {
  distributor: DistributorSummary | null;
  setDistributor: (d: DistributorSummary | null) => void;
}

const DistributorContext = createContext<DistributorState | undefined>(undefined);

export function DistributorProvider({ children }: { children: React.ReactNode }) {
  const [distributor, setDistributorState] = useState<DistributorSummary | null>(null);

  const setDistributor = useCallback((d: DistributorSummary | null) => setDistributorState(d), []);

  const value = useMemo(() => ({ distributor, setDistributor }), [distributor, setDistributor]);

  return <DistributorContext.Provider value={value}>{children}</DistributorContext.Provider>;
}

export function useDistributor(): DistributorState {
  const ctx = useContext(DistributorContext);
  if (!ctx) throw new Error("useDistributor must be used within DistributorProvider");
  return ctx;
}
