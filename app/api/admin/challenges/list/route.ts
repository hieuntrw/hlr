import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// use shared `ensureAdmin` helper

export async function GET(request: NextRequest) {
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

    // Prefer selecting the cached `participant_count` column if present in DB.
    // If the column is missing in older DBs, fall back to counting participants.
    const challengesRes = await supabaseAuth
      .from('challenges')
      .select('id, title, start_date, end_date, registration_deadline, status, is_locked, is_hide, created_by, profiles(full_name), participant_count')
      .order('start_date', { ascending: false });

    if (challengesRes.error) {
      const msg = String(challengesRes.error.message || challengesRes.error);
      // If participant_count column doesn't exist, fall back to older approach
      if (/participant_count/i.test(msg) && /does not exist/i.test(msg)) {
        const { data: challenges, error } = await supabaseAuth
          .from('challenges')
          .select('id, title, start_date, end_date, registration_deadline, status, is_locked, is_hide, created_by, profiles(full_name)')
          .order('start_date', { ascending: false });

        if (error) {
          serverDebug.error('GET /api/admin/challenges/list fetch challenges error', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const ids = (challenges || []).map((c: Record<string, unknown>) => c.id).filter(Boolean) as string[];
        const countsMap: Record<string, number> = {};
        if (ids.length > 0) {
          const { data: parts, error: pErr } = await supabaseAuth
            .from('challenge_participants')
            .select('challenge_id')
            .in('challenge_id', ids as string[]);

          if (pErr) {
            serverDebug.error('GET /api/admin/challenges/list fetch participants error', pErr);
          } else if (parts) {
            for (const p of parts) {
              const cid = p.challenge_id;
              countsMap[cid] = (countsMap[cid] || 0) + 1;
            }
          }
        }

        const enriched = (challenges || []).map((c) => ({ ...(c as Record<string, unknown>), participant_count: countsMap[(c as Record<string, unknown>).id as string] || 0 }));
        return NextResponse.json({ challenges: enriched });
      }

      serverDebug.error('GET /api/admin/challenges/list fetch challenges error', challengesRes.error);
      return NextResponse.json({ error: challengesRes.error.message }, { status: 500 });
    }

    // Success path: use participant_count from DB (fallback to 0)
    const enriched = (challengesRes.data || []).map((c) => ({ ...(c as Record<string, unknown>), participant_count: Number((c as Record<string, unknown>).participant_count || 0) }));
    return NextResponse.json({ challenges: enriched });
  } catch (err: unknown) {
    serverDebug.error('GET /api/admin/challenges/list exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
