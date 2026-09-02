import { NextResponse } from "next/server";
import { deleteRenungan, getDay, updateRenungan } from "@/src/features/renungan/business/service";
import { assertIsoDate } from "@/src/features/renungan/business/payload-builder";
import { findByDate } from "@/src/features/renungan/data/repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ date: string }> };

async function resolveDate(ctx: Ctx): Promise<string> {
  const { date } = await ctx.params;
  return assertIsoDate(date);
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const dateIso = await resolveDate(ctx);
    const day = await getDay(dateIso);
    return NextResponse.json(day);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[api/renungan/[date]] GET failed", { error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const dateIso = await resolveDate(ctx);
    const existing = await findByDate(dateIso);
    if (!existing) return NextResponse.json({ error: `no renungan for ${dateIso}` }, { status: 404 });
    const body = (await request.json()) as unknown;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "body must be JSON object" }, { status: 400 });
    }
    const updated = await updateRenungan(existing.id, body as never);
    return NextResponse.json({
      id: updated.id.toString(),
      date: typeof updated.date === "string" ? updated.date : new Date(updated.date as string).toISOString().slice(0, 10),
      title: updated.title,
      content: updated.content,
      scriptureRef: updated.scriptureRef,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[api/renungan/[date]] PUT failed", { error: message });
    const status = message.includes("already exists") ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const dateIso = await resolveDate(ctx);
    const existing = await findByDate(dateIso);
    if (!existing) return NextResponse.json({ error: `no renungan for ${dateIso}` }, { status: 404 });
    await deleteRenungan(existing.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[api/renungan/[date]] DELETE failed", { error: message });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
