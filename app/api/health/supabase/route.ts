import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/src/shared/services/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    user: data.user,
  });
}
