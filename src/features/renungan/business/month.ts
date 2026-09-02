const MIN_MONTH = 1;
const MAX_MONTH = 12;

export type MonthRange = { start: string; end: string; days: string[] };

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

export function daysInMonth(year: number, month: number): number {
  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error(`year/month must be integers, got: ${year}/${month}`);
  }
  if (month < MIN_MONTH || month > MAX_MONTH) {
    throw new Error(`month must be ${MIN_MONTH}-${MAX_MONTH}, got: ${month}`);
  }
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function buildMonthRange(year: number, month: number): MonthRange {
  const total = daysInMonth(year, month);
  const days: string[] = [];
  for (let d = 1; d <= total; d += 1) {
    days.push(`${year}-${pad2(month)}-${pad2(d)}`);
  }
  return { start: days[0], end: days[days.length - 1], days };
}

export function parseMonthParam(monthParam: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam);
  if (!match) throw new Error(`month must be YYYY-MM, got: "${monthParam}"`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < MIN_MONTH || month > MAX_MONTH) {
    throw new Error(`month out of range: "${monthParam}"`);
  }
  return { year, month };
}
