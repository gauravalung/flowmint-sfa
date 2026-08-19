// Human-readable, sortable order numbers. Not a security-relevant ID —
// the real primary key is the UUID `id` column.
export function generateOrderNumber(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, "0");
  return `ORD-${y}${m}${d}-${rand}`;
}
