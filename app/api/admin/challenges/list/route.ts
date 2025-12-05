import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

async function ensureAdmin(supabaseAuth: any, request: NextRequest) {
  const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
  if (userError || !user) throw { status: 401, message: 'Không xác thực' };

  const { data: profile } = await supabaseAuth
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role;
  if (!role || !['admin', 'mod_challenge'].includes(role)) throw { status: 403, message: 'Không có quyền' };
  return { user, role };
}

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

    await ensureAdmin(supabaseAuth, request);

    // Prefer selecting the cached `participant_count` column if present in DB.
    // If the column is missing in older DBs, fall back to counting participants.
    let challengesRes = await supabaseAuth
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
          console.error('GET /api/admin/challenges/list fetch challenges error', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const ids = (challenges || []).map((c: any) => c.id).filter(Boolean);
        let countsMap: Record<string, number> = {};
        if (ids.length > 0) {
          const { data: parts, error: pErr } = await supabaseAuth
            .from('challenge_participants')
            .select('challenge_id')
            .in('challenge_id', ids as any[]);

          if (pErr) {
            console.error('GET /api/admin/challenges/list fetch participants error', pErr);
          } else if (parts) {
            for (const p of parts) {
              const cid = p.challenge_id;
              countsMap[cid] = (countsMap[cid] || 0) + 1;
            }
          }
        }

        const enriched = (challenges || []).map((c: any) => ({ ...c, participant_count: countsMap[c.id] || 0 }));
        return NextResponse.json({ challenges: enriched });
      }

      console.error('GET /api/admin/challenges/list fetch challenges error', challengesRes.error);
      return NextResponse.json({ error: challengesRes.error.message }, { status: 500 });
    }

    // Success path: use participant_count from DB (fallback to 0)
    const enriched = (challengesRes.data || []).map((c: any) => ({ ...c, participant_count: Number(c.participant_count || 0) }));
    return NextResponse.json({ challenges: enriched });
  } catch (err: any) {
    console.error('GET /api/admin/challenges/list exception', err);
    const status = err?.status || 500;
    return NextResponse.json({ error: err?.message || String(err) }, { status });
  }
}
