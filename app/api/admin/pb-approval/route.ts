import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import serverDebug from '@/lib/server-debug';
import { requireAdminFromRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

interface ProfileRow {
  id: string;
  full_name?: string | null;
  pb_fm_seconds?: number | null;
  pb_hm_seconds?: number | null;
  pb_fm_approved?: boolean | null;
  pb_hm_approved?: boolean | null;
}

type NormalizedPBRow = {
  id: string;
  user_id: string;
  distance: 'HM' | 'FM';
  time_seconds: number;
  achieved_at: string | null;
  profile: { full_name?: string | null };
  pb_hm_seconds?: number;
  pb_hm_approved?: boolean;
  pb_fm_seconds?: number;
  pb_fm_approved?: boolean;
};

// use shared `ensureAdmin` helper

export async function GET(request: NextRequest) {
  const start = Date.now();
  try {
    await requireAdminFromRequest((n: string) => request.cookies.get(n)?.value);

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error("SUPABASE_SERVICE_ROLE_KEY not configured");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Only load PBs that have a PB time and are not yet approved for their distance
    // HM: pb_hm_seconds > 0 AND pb_hm_approved = false
    // FM: pb_fm_seconds > 0 AND pb_fm_approved = false
    // Load pending PBs from profiles only, and expand per-distance rows
    const { data: profiles, error } = await service
      .from("profiles")
      .select("id, full_name, pb_fm_seconds, pb_hm_seconds, pb_fm_approved, pb_hm_approved")
      .or(
        "and(pb_hm_seconds.gt.0,pb_hm_approved.is.false),and(pb_fm_seconds.gt.0,pb_fm_approved.is.false)"
      )
      .order("full_name", { ascending: true });

    if (error) {
      serverDebug.error("Failed to fetch pending PBs", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build per-distance pending rows from profiles
    const normalized: NormalizedPBRow[] = [];
    const profilesData = profiles as ProfileRow[] | null;
    (profilesData || []).forEach((p) => {
      const id = p.id;
      const name = p.full_name;
      const fmSec = Number(p.pb_fm_seconds ?? 0);
      const hmSec = Number(p.pb_hm_seconds ?? 0);
      const fmApproved = p.pb_fm_approved === true;
      const hmApproved = p.pb_hm_approved === true;

      if (hmSec > 0 && !hmApproved) {
        normalized.push({
          id: `${id}-HM`,
          user_id: id,
          distance: 'HM',
          time_seconds: hmSec,
          achieved_at: null,
          profile: { full_name: name },
          pb_hm_seconds: hmSec,
          pb_hm_approved: hmApproved,
        });
      }

      if (fmSec > 0 && !fmApproved) {
        normalized.push({
          id: `${id}-FM`,
          user_id: id,
          distance: 'FM',
          time_seconds: fmSec,
          achieved_at: null,
          profile: { full_name: name },
          pb_fm_seconds: fmSec,
          pb_fm_approved: fmApproved,
        });
      }
    });

    return NextResponse.json({ data: normalized });
  } catch (err: unknown) {
    serverDebug.error("Exception in admin pb-approval", err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  } finally {
    serverDebug.info("[admin/pb-approval] duration_ms:", Date.now() - start);
  }
}

export async function POST(request: NextRequest) {
    // Approve PB: set the approved flag on the user's profile for the given distance
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const userId = body?.user_id as string | undefined;
    const distance = (body?.distance as string | undefined) || undefined;
    if (!userId || !distance) return NextResponse.json({ error: "Missing user_id or distance" }, { status: 400 });

    await requireAdminFromRequest((n: string) => request.cookies.get(n)?.value);

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error("SUPABASE_SERVICE_ROLE_KEY not configured");
      return NextResponse.json({ error: "Server not configured" }, { status: 500 });
    }

    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Update the corresponding approved flag on profiles based on provided userId and distance
    const updateObj: Record<string, unknown> = {};
    if (distance === "HM") {
      updateObj.pb_hm_approved = true;
    } else if (distance === "FM") {
      updateObj.pb_fm_approved = true;
    } else {
      return NextResponse.json({ error: "Unknown distance" }, { status: 400 });
    }

    const { data: prof, error: profErr } = await service
      .from('profiles')
      .update(updateObj)
      .eq('id', userId)
      .select('id, full_name, pb_fm_approved, pb_hm_approved')
      .single();

    if (profErr) {
      serverDebug.error("Failed to update profile approved flag", profErr);
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }

    // Do not touch pb_history or other tables; return updated profile
    return NextResponse.json({ data: prof });
  } catch (err: unknown) {
    serverDebug.error("Exception approving PB", err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

