import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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

    // Use service role key for debug operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return NextResponse.json({ error: error.message || String(error) }, { status: 401 });
    }

    return NextResponse.json({ ok: true, user: data.user ?? null });
  } catch (err: unknown) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
