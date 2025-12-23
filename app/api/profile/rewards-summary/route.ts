import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug';


export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value; }, set() {}, remove() {} } }
    );

    // Reconstruct session if needed using shared helper
    const { getUserFromAuthClient } = await import('@/lib/server-auth');
    const user = await getUserFromAuthClient(supabase, (name: string) => request.cookies.get(name)?.value);
    if (!user) return NextResponse.json({ ok: false, error: 'Không xác thực' }, { status: 401 });

    // Fetch profile row
    const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

    // Parse optional date range for aggregated counts (e.g., yearly stars)
    const q = request.nextUrl.searchParams;
    const startDate = q.get('start') || null;
    const endDate = q.get('end') || null;

    // Active reward milestones
    const { data: milestones } = await supabase.from('reward_milestones').select('*').eq('is_active', true).order('priority', { ascending: true });

    // Achieved milestones
    const { data: achieved } = await supabase
      .from('member_milestone_rewards')
      .select('*, race:races(name, date), milestone:reward_milestones(*)')
      .eq('member_id', user.id)
      .order('created_at', { ascending: false });

    // Podium rewards
    const { data: podium } = await supabase
      .from('member_podium_rewards')
      .select('*, race:races(name, date)')
      .eq('member_id', user.id)
      .order('created_at', { ascending: false });

    // Lucky draw wins
    const { data: lucky } = await supabase
      .from('lucky_draw_winners')
      .select('*, challenge:challenges(name, month, year)')
      .eq('member_id', user.id)
      .order('created_at', { ascending: false });

    // Star totals (now stored in member_star_awards). Use created_at range when provided.
    let star_total = 0;
    try {
      let starQuery = supabase.from('member_star_awards').select('stars_awarded').eq('user_id', user.id);
      if (startDate) starQuery = starQuery.gte('created_at', startDate);
      if (endDate) starQuery = starQuery.lte('created_at', endDate);
      const { data: stars, error: starsErr } = await starQuery;
      if (!starsErr && Array.isArray(stars)) {
        star_total = stars.reduce((s: number, r: unknown) => {
          const rr = r as Record<string, unknown>;
          const q = rr['stars_awarded'];
          return s + (Number(q ?? 0) || 0);
        }, 0);
      } else if (starsErr) {
        serverDebug.warn('[profile.rewards-summary] star total query error', starsErr);
      }
    } catch (e: unknown) {
      serverDebug.warn('[profile.rewards-summary] star aggregation failed', String(e));
    }

    return NextResponse.json({ ok: true, profile: profileRow ?? null, milestones: milestones || [], achieved: achieved || [], podium: podium || [], lucky: lucky || [], star_total });
  } catch (err: unknown) {
    serverDebug.error('[profile.rewards-summary] exception', String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
