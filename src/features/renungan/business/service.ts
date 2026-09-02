import { getSeededImageUrl } from "@/src/shared/services/unsplash-image";
import {
  findByDate,
  findByDateRange,
  insertRenungan,
  softDeleteById,
  updateRenunganById,
} from "../data/repository";
import type { RenunganDailyRow } from "../data/schema";
import { buildMonthRange } from "./month";
import {
  buildRenunganInsert,
  buildRenunganPatch,
  type RenunganInput,
} from "./payload-builder";
import { fetchScripture, type ScriptureLookup } from "./scripture-client";

export type RenunganDayEntry = {
  date: string;
  hasContent: boolean;
  imageUrl: string;
  id: string | null;
  title: string | null;
  content: string | null;
  scripture: ScriptureLookup | null;
};

function toIsoDate(row: RenunganDailyRow): string {
  return typeof row.date === "string" ? row.date : new Date(row.date).toISOString().slice(0, 10);
}

async function toDayEntry(dateIso: string, row: RenunganDailyRow | undefined): Promise<RenunganDayEntry> {
  const imageUrl = getSeededImageUrl(dateIso);
  if (!row) {
    return { date: dateIso, hasContent: false, imageUrl, id: null, title: null, content: null, scripture: null };
  }
  const scripture = await fetchScripture(row.scriptureRef);
  return {
    date: dateIso,
    hasContent: true,
    imageUrl,
    id: row.id.toString(),
    title: row.title,
    content: row.content,
    scripture,
  };
}

export async function getMonth(year: number, month: number): Promise<RenunganDayEntry[]> {
  const { start, end, days } = buildMonthRange(year, month);
  const rows = await findByDateRange(start, end);
  const byDate = new Map(rows.map((r) => [toIsoDate(r), r]));
  // ponytail: month has ≤31 days → bounded fan-out is safe. Add per-request
  // cache or persist scripture text if api.alkitab.mobi latency shows up.
  return Promise.all(days.map((d) => toDayEntry(d, byDate.get(d))));
}

export async function getDay(dateIso: string): Promise<RenunganDayEntry> {
  const row = await findByDate(dateIso);
  return toDayEntry(dateIso, row ?? undefined);
}

export async function createRenungan(input: RenunganInput): Promise<RenunganDailyRow> {
  const row = buildRenunganInsert(input);
  const existing = await findByDate(row.date as string);
  if (existing) throw new Error(`renungan already exists for date ${row.date as string}`);
  return insertRenungan(row);
}

export async function updateRenungan(id: bigint, input: Partial<RenunganInput>): Promise<RenunganDailyRow> {
  const patch = buildRenunganPatch(input);
  if (patch.date) {
    const clash = await findByDate(patch.date as string);
    if (clash && clash.id !== id) {
      throw new Error(`renungan already exists for date ${patch.date as string}`);
    }
  }
  const updated = await updateRenunganById(id, patch);
  if (!updated) throw new Error(`renungan ${id.toString()} not found`);
  return updated;
}

export async function deleteRenungan(id: bigint): Promise<void> {
  const ok = await softDeleteById(id);
  if (!ok) throw new Error(`renungan ${id.toString()} not found`);
}
