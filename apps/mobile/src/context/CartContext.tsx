import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ProductSummary } from "@flowmint/shared";

// In-memory only, scoped to the app's lifetime — no persistence across app
// restarts and no offline outbox (that's a deliberately deferred follow-up,
// see README's Codespaces/ordering notes). Fine for "online ordering
// first": a killed app mid-order loses the cart, same as any unsaved form.
export interface CartLine {
  product: ProductSummary;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  totalQty: number;
  setQuantity: (product: ProductSummary, quantity: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [linesByProductId, setLinesByProductId] = useState<Map<string, CartLine>>(new Map());

  const setQuantity = useCallback((product: ProductSummary, quantity: number) => {
    setLinesByProductId((prev) => {
      const next = new Map(prev);
      if (quantity <= 0) {
        next.delete(product.id);
      } else {
        next.set(product.id, { product, quantity });
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setLinesByProductId(new Map()), []);

  const lines = useMemo(() => Array.from(linesByProductId.values()), [linesByProductId]);
  const totalQty = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines]);

  const value = useMemo(
    () => ({ lines, totalQty, setQuantity, clear }),
    [lines, totalQty, setQuantity, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
