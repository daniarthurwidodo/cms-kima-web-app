import { and, count, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/src/db/client";
import { renunganDaily, type RenunganDailyInsert, type RenunganDailyRow } from "./schema";

const activeOnly = () => isNull(renunganDaily.deletedAt);

export async function countActive(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(renunganDaily).where(activeOnly());
  return row?.n ?? 0;
}

export async function findByDate(dateIso: string): Promise<RenunganDailyRow | null> {
  const rows = await db
    .select()
    .from(renunganDaily)
    .where(and(eq(renunganDaily.date, dateIso), activeOnly()))
    .limit(1);
  return rows[0] ?? null;
}

export async function findByDateRange(startIso: string, endIso: string): Promise<RenunganDailyRow[]> {
  return db
    .select()
    .from(renunganDaily)
    .where(and(gte(renunganDaily.date, startIso), lte(renunganDaily.date, endIso), activeOnly()));
}

export async function insertRenungan(row: RenunganDailyInsert): Promise<RenunganDailyRow> {
  const [inserted] = await db.insert(renunganDaily).values(row).returning();
  if (!inserted) throw new Error("insertRenungan: no row returned");
  return inserted;
}

export async function updateRenunganById(
  id: bigint,
  patch: Partial<Pick<RenunganDailyInsert, "title" | "content" | "scriptureRef" | "date">>,
): Promise<RenunganDailyRow | null> {
  const [updated] = await db
    .update(renunganDaily)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(renunganDaily.id, id), activeOnly()))
    .returning();
  return updated ?? null;
}

export async function softDeleteById(id: bigint): Promise<boolean> {
  const [updated] = await db
    .update(renunganDaily)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(renunganDaily.id, id), activeOnly()))
    .returning({ id: renunganDaily.id });
  return Boolean(updated);
}
