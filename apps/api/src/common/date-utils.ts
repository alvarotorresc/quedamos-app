/** Shared date helpers. Everything the API stores as a day is a UTC-midnight `@db.Date`. */

const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True only for a real YYYY-MM-DD day. The format regex alone accepts 2026-02-30,
 * which `new Date()` silently rolls over to March 3rd, and 2026-13-01, which becomes
 * an Invalid Date that reaches Prisma as a 500.
 */
export function isCalendarDate(value: string): boolean {
  if (!CALENDAR_DATE.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

/**
 * Midnight UTC of the current day — the cutoff for "today and later" over `@db.Date`
 * columns, which are stored at UTC midnight. Using the server's local midnight (or the
 * current instant) shifts the boundary with the container timezone and drops today.
 */
export function startOfTodayUTC(now: Date = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
