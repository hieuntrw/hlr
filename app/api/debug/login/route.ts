import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const allow = process.env.ALLOW_DEBUG_LOGIN === "1";
  if (!allow) {
    return NextResponse.json({ error: "Debug login disabled" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, password } = body;
    if (!email || !password) {
      return NextResponse.json({ error: "email and password required" }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: error.message || String(error) }, { status: 401 });
    }

    return NextResponse.json({ ok: true, user: data.user ?? null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
