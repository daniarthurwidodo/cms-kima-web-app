import { NextResponse } from "next/server";
import { createRenungan, getMonth } from "@/src/features/renungan/business/service";
import { parseMonthParam } from "@/src/features/renungan/business/month";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function currentMonthParam(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = (now.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${y}-${m}`;
}

function serializeRow(row: { id: bigint; date: unknown; title: string; content: string; scriptureRef: string; createdAt: Date; updatedAt: Date }) {
  return {
    id: row.id.toString(),
    date: typeof row.date === "string" ? row.date : new Date(row.date as string).toISOString().slice(0, 10),
    title: row.title,
    content: row.content,
    scriptureRef: row.scriptureRef,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const monthParam = url.searchParams.get("month") ?? currentMonthParam();
    const { year, month } = parseMonthParam(monthParam);
    const days = await getMonth(year, month);
    return NextResponse.json({ month: monthParam, days });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    // ponytail: console until src/shared/services/logger.ts exists
    console.error("[api/renungan] GET failed", { error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "body must be JSON object" }, { status: 400 });
    }
    const created = await createRenungan(body as never);
    return NextResponse.json(serializeRow(created), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[api/renungan] POST failed", { error: message });
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
