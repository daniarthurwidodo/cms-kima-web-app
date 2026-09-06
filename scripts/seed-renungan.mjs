#!/usr/bin/env node
// Seeds the renungan_daily table from scripts/data/renungan-2026-q4.mjs.
//
// Idempotent: a date that already has an active row is skipped, never
// overwritten. Run it as many times as you like.
//
//   pnpm db:seed:renungan            # insert missing days
//   pnpm db:seed:renungan --dry-run  # report what would change, write nothing
//
// Uses DIRECT_URL (5432) when present, otherwise DATABASE_URL. Migrations and
// seeds never run at request time — this is a local/CI script only.

import process from "node:process";
import postgres from "postgres";
import { renunganSeed } from "./data/renungan-2026-q4.mjs";

const dryRun = process.argv.includes("--dry-run");

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DIRECT_URL or DATABASE_URL is required (load .env.local first).");
  process.exit(1);
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertSeedShape(rows) {
  const seen = new Set();
  for (const row of rows) {
    if (!ISO_DATE.test(row.date)) throw new Error(`bad date: ${row.date}`);
    if (seen.has(row.date)) throw new Error(`duplicate date in seed data: ${row.date}`);
    seen.add(row.date);
    for (const field of ["title", "content", "scriptureRef"]) {
      if (typeof row[field] !== "string" || !row[field].trim()) {
        throw new Error(`${row.date}: ${field} is empty`);
      }
    }
  }
}

async function main() {
  assertSeedShape(renunganSeed);

  const sql = postgres(connectionString, { prepare: false, max: 1 });
  try {
    const existing = await sql`
      SELECT date::text AS date
      FROM renungan_daily
      WHERE deleted_at IS NULL
        AND date BETWEEN ${renunganSeed[0].date} AND ${renunganSeed[renunganSeed.length - 1].date}
    `;
    const taken = new Set(existing.map((r) => r.date));
    const missing = renunganSeed.filter((r) => !taken.has(r.date));

    console.log(
      `range ${renunganSeed[0].date}..${renunganSeed[renunganSeed.length - 1].date} — ` +
        `${renunganSeed.length} seed days, ${taken.size} already present, ${missing.length} to insert`,
    );

    if (dryRun || missing.length === 0) {
      if (dryRun) console.log("dry run: nothing written");
      return;
    }

    const payload = missing.map((r) => ({
      date: r.date,
      title: r.title,
      content: r.content,
      scripture_ref: r.scriptureRef,
    }));

    const inserted = await sql`
      INSERT INTO renungan_daily ${sql(payload, "date", "title", "content", "scripture_ref")}
      RETURNING date::text AS date
    `;
    console.log(`inserted ${inserted.length} rows (${inserted[0].date} .. ${inserted[inserted.length - 1].date})`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
