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
