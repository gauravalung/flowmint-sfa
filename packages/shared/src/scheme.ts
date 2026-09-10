// Single hardcoded v1 scheme rule — deliberately NOT a scheme engine.
// See SFA_MVP_Scope_Locked.md §6 (confirmed 2026-08-18).
//
// Rule (non-stacking slabs, literal boundaries):
//   subtotal < 2500        -> 0%
//   2500 <= subtotal <= 5000 -> 2%
//   subtotal > 5000         -> 5%
//
// If a second scheme rule is ever needed, THAT is the trigger to build a
// real schemes/scheme_slabs table structure — not before.

export function getDiscountPct(subtotal: number): number {
  if (subtotal > 5000) return 5;
  if (subtotal >= 2500) return 2;
  return 0;
}

// Order-level discount + per-line GST, per SFA_MVP_Scope_Locked.md §6:
// the single discount % is apportioned across lines proportionally to each
// line's share of the pretax subtotal, then each line's own GST rate
// applies to its post-discount amount. Everything rounds to 2 decimals at
// the line level *before* summing, so the displayed total never drifts by a
// paisa from the stored total — used both server-side (source of truth, the
// only place an order is actually priced) and client-side (live cart
// preview before submit, using the same prices the server already returned
// for the catalog — never re-derived independently).

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface OrderCalcLineInput {
  productId: string;
  unitPrice: number;
  quantity: number;
  gstRate: number;
}

export interface OrderCalcLineResult extends OrderCalcLineInput {
  lineAmount: number;
  lineDiscountAmount: number;
  lineTaxableAmount: number;
  lineGstAmount: number;
  lineTotal: number;
}

export interface OrderCalcResult {
  lines: OrderCalcLineResult[];
  subtotalAmount: number;
  discountPct: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  grandTotalAmount: number;
}

export function computeOrderTotals(items: OrderCalcLineInput[]): OrderCalcResult {
  const lineAmounts = items.map((item) => round2(item.unitPrice * item.quantity));
  const subtotalAmount = round2(lineAmounts.reduce((sum, amount) => sum + amount, 0));
  const discountPct = getDiscountPct(subtotalAmount);
  const discountAmount = round2(subtotalAmount * (discountPct / 100));

  let taxableAmount = 0;
  let gstAmount = 0;
  const lines: OrderCalcLineResult[] = items.map((item, i) => {
    const lineAmount = lineAmounts[i];
    const lineDiscountAmount =
      subtotalAmount > 0 ? round2((lineAmount * discountAmount) / subtotalAmount) : 0;
    const lineTaxableAmount = round2(lineAmount - lineDiscountAmount);
    const lineGstAmount = round2(lineTaxableAmount * (item.gstRate / 100));
    const lineTotal = round2(lineTaxableAmount + lineGstAmount);
    taxableAmount = round2(taxableAmount + lineTaxableAmount);
    gstAmount = round2(gstAmount + lineGstAmount);
    return { ...item, lineAmount, lineDiscountAmount, lineTaxableAmount, lineGstAmount, lineTotal };
  });

  const grandTotalAmount = round2(taxableAmount + gstAmount);

  return { lines, subtotalAmount, discountPct, discountAmount, taxableAmount, gstAmount, grandTotalAmount };
}
