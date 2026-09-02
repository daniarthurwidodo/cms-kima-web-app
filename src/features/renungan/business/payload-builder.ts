import type { RenunganDailyInsert } from "../data/schema";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type RenunganInput = {
  date: string;
  title: string;
  content: string;
  scriptureRef: string;
};

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} must be a string`);
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${field} is required`);
  return trimmed;
}

export function assertIsoDate(value: string, field = "date"): string {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`${field} must be ISO date (YYYY-MM-DD), got: "${value}"`);
  }
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) {
    throw new Error(`${field} is not a valid calendar date: "${value}"`);
  }
  return value;
}

export function buildRenunganInsert(input: RenunganInput): RenunganDailyInsert {
  return {
    date: assertIsoDate(requireString(input.date, "date")),
    title: requireString(input.title, "title"),
    content: requireString(input.content, "content"),
    scriptureRef: requireString(input.scriptureRef, "scriptureRef"),
  };
}

export function buildRenunganPatch(input: Partial<RenunganInput>) {
  const patch: Partial<RenunganDailyInsert> = {};
  if (input.date !== undefined) patch.date = assertIsoDate(requireString(input.date, "date"));
  if (input.title !== undefined) patch.title = requireString(input.title, "title");
  if (input.content !== undefined) patch.content = requireString(input.content, "content");
  if (input.scriptureRef !== undefined) patch.scriptureRef = requireString(input.scriptureRef, "scriptureRef");
  return patch;
}
