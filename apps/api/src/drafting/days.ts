// Counting days the way South African statutes and rules do: business and
// court days skip Saturdays, Sundays and public holidays (Public Holidays
// Act 36 of 1994; a holiday on a Sunday moves to the Monday).
// Dates are plain YYYY-MM-DD strings, read as South African calendar days.

function easterSunday(year: number): Date {
  // Anonymous Gregorian algorithm (Meeus/Jones/Butcher).
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86_400_000);

const FIXED = [
  '01-01',
  '03-21',
  '04-27',
  '05-01',
  '06-16',
  '08-09',
  '09-24',
  '12-16',
  '12-25',
  '12-26',
];

/** South African public holidays in a year (with Sunday holidays moved to Monday). */
export function publicHolidays(year: number): Set<string> {
  const days = new Set<string>();
  for (const md of FIXED) {
    const date = new Date(`${year}-${md}T00:00:00Z`);
    days.add(iso(date));
    if (date.getUTCDay() === 0) days.add(iso(addDays(date, 1)));
  }
  const easter = easterSunday(year);
  days.add(iso(addDays(easter, -2))); // Good Friday
  days.add(iso(addDays(easter, 1))); // Family Day
  return days;
}

export function parseDate(value: string | undefined): Date | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || iso(date) !== value ? null : date;
}

/** Not a Saturday, Sunday or public holiday. */
export function isBusinessDay(value: string): boolean {
  const date = parseDate(value);
  if (!date) return false;
  const day = date.getUTCDay();
  return day !== 0 && day !== 6 && !publicHolidays(date.getUTCFullYear()).has(value);
}

/** The date that many business (court) days after the given date. */
export function addBusinessDays(from: string, days: number): string | null {
  let date = parseDate(from);
  if (!date) return null;
  let left = days;
  while (left > 0) {
    date = addDays(date, 1);
    if (isBusinessDay(iso(date))) left -= 1;
  }
  return iso(date);
}

/** Business days strictly after `from` up to and including `to`. */
export function businessDaysBetween(from: string, to: string): number | null {
  const start = parseDate(from);
  const end = parseDate(to);
  if (!start || !end) return null;
  let count = 0;
  for (let date = addDays(start, 1); date <= end; date = addDays(date, 1)) {
    if (isBusinessDay(iso(date))) count += 1;
  }
  return count;
}

/** Calendar months between two dates (whole months, then days), for six-month limits. */
export function addMonths(from: string, months: number): string | null {
  const date = parseDate(from);
  if (!date) return null;
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()),
  );
  // 31 August + 6 months is 28/29 February, not 3 March.
  if (target.getUTCDate() !== date.getUTCDate()) target.setUTCDate(0);
  return iso(target);
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** 2026-06-01 → 1 June 2026 (as South African documents write dates). */
export function longDate(value: string | undefined): string {
  const date = parseDate(value);
  if (!date) return value ?? '';
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** 16 December to 15 January, which is not counted for a notice of intention to defend (Uniform Rule 19(1)). */
export function inDiesNon(value: string): boolean {
  const monthDay = value.slice(5);
  return monthDay >= '12-16' || monthDay <= '01-15';
}

/** Court days after a date, optionally leaving out 16 December to 15 January. */
export function addCourtDays(
  from: string,
  days: number,
  options: { skipDiesNon?: boolean } = {},
): string | null {
  let date = parseDate(from);
  if (!date) return null;
  let left = days;
  while (left > 0) {
    date = addDays(date, 1);
    const day = iso(date);
    if (isBusinessDay(day) && !(options.skipDiesNon && inDiesNon(day))) left -= 1;
  }
  return iso(date);
}

/**
 * The last day of a period of calendar days (Interpretation Act 33 of 1957 s 4):
 * leave out the first day, count the last, and move past a last day that is
 * a Sunday or public holiday.
 */
export function addCalendarDays(from: string, days: number): string | null {
  const start = parseDate(from);
  if (!start) return null;
  let date = addDays(start, days);
  while (date.getUTCDay() === 0 || publicHolidays(date.getUTCFullYear()).has(iso(date))) {
    date = addDays(date, 1);
  }
  return iso(date);
}
