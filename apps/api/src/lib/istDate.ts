// The pilot salesman, every retailer, and every beat cycle live in India.
// If "today" were computed from the server's own clock (Render runs UTC),
// the day-of-week and date would silently roll over 5.5 hours early/late —
// e.g. a beat mapped to Monday would show as Sunday's beat from 12:00am to
// 5:30am IST. Not flagged by the user, caught here because it's a real
// correctness bug waiting for the first late-night or early-morning use.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function istNow(): Date {
  return new Date(Date.now() + IST_OFFSET_MS);
}

// 0 = Sunday .. 6 = Saturday, matching JS Date#getDay() and the seed data's
// day_of_week mapping (beat_employee_mapping.day_of_week).
export function istDayOfWeek(): number {
  return istNow().getUTCDay();
}

// YYYY-MM-DD in IST, for visit_date / order_date columns (DATE, not TIMESTAMPTZ).
export function istDateString(): string {
  return istNow().toISOString().slice(0, 10);
}
