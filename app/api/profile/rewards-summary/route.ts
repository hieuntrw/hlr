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

    // Reconstruct session if needed
    let { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      try {
        const acc = request.cookies.get('sb-access-token')?.value;
        const ref = request.cookies.get('sb-refresh-token')?.value;
        if (acc && ref) {
          await supabase.auth.setSession({ access_token: acc, refresh_token: ref });
          const retry = await supabase.auth.getUser();
          user = retry.data.user;
        }
      } catch (e: unknown) {
        serverDebug.warn('[profile.rewards-summary] session reconstruction failed', String(e));
      }
    }

    if (!user) return NextResponse.json({ ok: false, error: 'Không xác thực' }, { status: 401 });

    // Fetch profile row
    const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

    // Active reward milestones
    const { data: milestones } = await supabase.from('reward_milestones').select('*').eq('is_active', true).order('priority', { ascending: true });

    // Achieved milestones
    const { data: achieved } = await supabase
      .from('member_milestone_rewards')
      .select('*, race:races(name, date), milestone:reward_milestones(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Podium rewards
    const { data: podium } = await supabase
      .from('member_podium_rewards')
      .select('*, race:races(name, date)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Lucky draw wins
    const { data: lucky } = await supabase
      .from('lucky_draw_winners')
      .select('*, challenge:challenges(name, month, year)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ ok: true, profile: profileRow ?? null, milestones: milestones || [], achieved: achieved || [], podium: podium || [], lucky: lucky || [] });
  } catch (err: unknown) {
    serverDebug.error('[profile.rewards-summary] exception', String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
