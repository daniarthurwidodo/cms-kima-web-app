import { bigserial, date, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const renunganDaily = pgTable(
  "renungan_daily",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    date: date("date").notNull(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    scriptureRef: text("scripture_ref").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("idx_renungan_daily_date").on(t.date)],
);

export type RenunganDailyRow = typeof renunganDaily.$inferSelect;
export type RenunganDailyInsert = typeof renunganDaily.$inferInsert;
