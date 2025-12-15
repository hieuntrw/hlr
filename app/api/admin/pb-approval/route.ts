import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
// SupabaseClient type removed — not needed in this route
import { createClient } from "@supabase/supabase-js";
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// use shared `ensureAdmin` helper

export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    await ensureAdmin(supabaseAuth);

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error("SUPABASE_SERVICE_ROLE_KEY not configured");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data, error } = await service
      .from("pb_history")
      .select("id, user_id, distance, time_seconds, achieved_at, profiles(full_name)")
      .order("achieved_at", { ascending: false });

    if (error) {
      serverDebug.error("Failed to fetch pending pb_history", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    serverDebug.error("Exception in admin pb-approval", err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  } finally {
    serverDebug.info("[admin/pb-approval] duration_ms:", Date.now() - start);
  }
}

export async function POST(request: NextRequest) {
  // Approve PB: set race_results.approved=true and is_pr=true for matching record
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const pbId = body?.id as string | undefined;
    if (!pbId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    await ensureAdmin(supabaseAuth);

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error("SUPABASE_SERVICE_ROLE_KEY not configured");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { data: pbData, error: pbErr } = await service.from("pb_history").select("race_id, user_id, time_seconds").eq("id", pbId).single();
    if (pbErr) {
      serverDebug.error("Failed to load pb_history", pbErr);
      return NextResponse.json({ error: pbErr.message }, { status: 500 });
    }

    const { data: upd, error: updErr } = await service
      .from("race_results")
      .update({ approved: true, is_pr: true })
      .eq("user_id", pbData.user_id)
      .eq("race_id", pbData.race_id)
      .eq("chip_time_seconds", pbData.time_seconds);

    if (updErr) {
      serverDebug.error("Failed to update race_results", updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ data: upd });
  } catch (err: unknown) {
    serverDebug.error("Exception approving PB", err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    await ensureAdmin(supabaseAuth);

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error("SUPABASE_SERVICE_ROLE_KEY not configured");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { error } = await service.from("pb_history").delete().eq("id", id);
    if (error) {
      serverDebug.error("Failed to delete pb_history", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    serverDebug.error("Exception deleting PB", err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
