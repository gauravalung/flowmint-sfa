// Phase 1 scheme discount logic — supersedes the MVP's single-stage
// ₹2,500/₹5,000 → 0/2/5% rule. See claude/Flowmint_Phase1_Scope_Locked.md §9
// and claude/DECISIONS.md 2026-09-09.
//
// Slab basis: order's base amount excluding GST (non-stacking):
//   subtotal < 5,000            -> 0%
//   5,000 <= subtotal < 10,000  -> 5%
//   subtotal >= 10,000          -> 10%
//
// Applied TWICE per order, same function, different inputs:
//   - "tentative", at booking time, from the booked cart's line amounts.
//   - "final", at delivery time, from the actually-delivered line amounts
//     (delivered_quantity, falling back to booked quantity where a line
//     wasn't adjusted).
// Which stage a given call represents is the caller's concern (which lines
// it passes in) — this function itself is stage-agnostic.
//
// GST varies per product, so the order-level discount is apportioned across
// lines proportional to each line's pretax share, then each line's own GST
// rate applies to its post-discount amount. All rounding to 2 decimal
// places at the line level before summing, to avoid rupee-level drift
// between a displayed total and a stored total.

export function getDiscountPct(subtotal: number): number {
  if (subtotal >= 10_000) return 10;
  if (subtotal >= 5_000) return 5;
  return 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface SchemeLineInput {
  /** Opaque identifier the caller uses to match results back to its own line records. */
  key: string;
  /** Pretax line amount: unit price × the quantity relevant to this stage. */
  lineAmount: number;
  /** GST rate as a percentage, e.g. 18 for 18%. */
  gstRate: number;
}

export interface SchemeLineResult {
  key: string;
  lineAmount: number;
  lineDiscountAmount: number;
  lineTaxableAmount: number;
  lineGstAmount: number;
  lineTotal: number;
}

export interface SchemeBreakdown {
  subtotalAmount: number;
  discountPct: number;
  discountAmount: number;
  taxableAmount: number;
  gstAmount: number;
  grandTotalAmount: number;
  lines: SchemeLineResult[];
}

export function calculateSchemeBreakdown(lines: SchemeLineInput[]): SchemeBreakdown {
  const subtotalAmount = round2(lines.reduce((sum, l) => sum + l.lineAmount, 0));
  const discountPct = getDiscountPct(subtotalAmount);
  const discountAmount = round2((subtotalAmount * discountPct) / 100);

  const lineResults: SchemeLineResult[] = lines.map((line) => {
    const lineDiscountAmount =
      subtotalAmount > 0 ? round2(line.lineAmount * (discountAmount / subtotalAmount)) : 0;
    const lineTaxableAmount = round2(line.lineAmount - lineDiscountAmount);
    const lineGstAmount = round2((lineTaxableAmount * line.gstRate) / 100);
    const lineTotal = round2(lineTaxableAmount + lineGstAmount);
    return {
      key: line.key,
      lineAmount: round2(line.lineAmount),
      lineDiscountAmount,
      lineTaxableAmount,
      lineGstAmount,
      lineTotal,
    };
  });

  const taxableAmount = round2(lineResults.reduce((sum, l) => sum + l.lineTaxableAmount, 0));
  const gstAmount = round2(lineResults.reduce((sum, l) => sum + l.lineGstAmount, 0));
  const grandTotalAmount = round2(taxableAmount + gstAmount);

  return {
    subtotalAmount,
    discountPct,
    discountAmount,
    taxableAmount,
    gstAmount,
    grandTotalAmount,
    lines: lineResults,
  };
}
