export function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Extract YYYY-MM-DD from an API date string.
 * Handles ISO "2026-02-08T00:00:00.000Z" and plain "2026-02-08".
 * Uses regex to avoid any timezone shift issues.
 */
export function apiDateToKey(dateStr: string): string {
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : dateStr.slice(0, 10);
}

export function isSameDay(a: Date | null, b: Date | null): boolean {
  if (!a || !b) return false;
  return formatDateKey(a) === formatDateKey(b);
}

export function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

export function parseDateKey(key: string): Date {
  return new Date(key + 'T00:00:00');
}

export function getWeekDays(base: Date, weekOffset: number): Date[] {
  const d = new Date(base);
  d.setDate(d.getDate() + weekOffset * 7);
  const mon = new Date(d);
  mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(mon);
    x.setDate(x.getDate() + i);
    return x;
  });
}

export function getMonthCells(
  base: Date,
  monthOffset: number
): { cells: (Date | null)[]; month: Date } {
  const d = new Date(base.getFullYear(), base.getMonth() + monthOffset, 1);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const firstDow = (d.getDay() + 6) % 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let i = 1; i <= last; i++)
    cells.push(new Date(d.getFullYear(), d.getMonth(), i));
  return { cells, month: d };
}
