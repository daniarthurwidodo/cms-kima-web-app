import { sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/src/db/client";

export const runtime = "nodejs";

export async function GET() {
  const start = Date.now();
  try {
    const result = await db.execute(sql`select 1 as ok`);
    const latencyMs = Date.now() - start;
    // ponytail: console.* goes to Vercel function logs. Swap for structured
    // logger when one lands in src/shared/services.
    console.info("[health/db] connected", { latencyMs, result: result[0] });
    return NextResponse.json({ ok: true, latencyMs });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[health/db] failed", { error: message });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
