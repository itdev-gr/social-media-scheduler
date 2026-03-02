/**
 * Returns the number of days in a given month.
 */
export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Parses a "YYYY-MM" label into { year, month }.
 */
export function parseMonthLabel(label: string): { year: number; month: number } {
  const [y, m] = label.split('-').map(Number);
  return { year: y, month: m };
}

/**
 * Creates a YYYY-MM-DD string from year, month, day.
 */
export function makeDate(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Adds (or subtracts) days from a YYYY-MM-DD string. Returns a new YYYY-MM-DD string.
 */
export function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Converts year + month to a YYYY-MM label.
 */
export function toMonthLabel(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Generates a sequence of YYYY-MM labels starting from a given month.
 */
export function generateMonthSequence(
  startLabel: string,
  count: number
): { label: string; year: number; month: number }[] {
  const { year: startYear, month: startMonth } = parseMonthLabel(startLabel);
  const months: { label: string; year: number; month: number }[] = [];

  for (let i = 0; i < count; i++) {
    let m = startMonth + i;
    let y = startYear;
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    months.push({ label: toMonthLabel(y, m), year: y, month: m });
  }

  return months;
}
