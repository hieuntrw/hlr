import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
// note: do not use `createClient` in this server route; use createServerClient instead
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

export async function GET() {
  const start = Date.now();
  try {
    const cookieStore = cookies();

    try {
      const incoming = cookieStore.getAll().map((c) => ({ name: c.name, preview: c.value?.substring(0, 20) }));
      serverDebug.debug('[profile.rewards] incoming cookies:', incoming);
    } catch (e) {
      serverDebug.debug('[profile.rewards] failed to read cookie previews', String(e));
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    const { getUserFromAuthClient } = await import('@/lib/server-auth');
    const user = await getUserFromAuthClient(supabase, (name: string) => cookieStore.get(name)?.value);
    if (!user) return NextResponse.json({ ok: false, error: 'No user' }, { status: 401 });

    // Aggregate from the canonical reward tables: milestone, podium, lucky draws.
    try {
      const [mmrResp, podiumResp, luckyResp, starResp] = await Promise.all([
        supabase
          .from('member_milestone_rewards')
          .select('id, milestone_id, reward_description, cash_amount, status, approved_at, delivered_at, created_at')
          .eq('member_id', user.id),
        supabase
          .from('member_podium_rewards')
          .select('id, podium_config_id, podium_type, rank, reward_description, cash_amount, status, delivered_at, created_at')
          .eq('member_id', user.id),
        supabase
          .from('lucky_draw_winners')
          .select('id, challenge_id, reward_description, status, delivered_at, created_at')
          .eq('member_id', user.id),
          // Stars now in member_star_awards
          supabase
            .from('member_star_awards')
            .select('id, user_id, challenge_participant_id, stars_awarded, awarded_at')
            .eq('user_id', user.id),
      ]);

      if (mmrResp.error) serverDebug.warn('[profile.rewards] mmr query error', mmrResp.error);
      if (podiumResp.error) serverDebug.warn('[profile.rewards] podium query error', podiumResp.error);
      if (luckyResp.error) serverDebug.warn('[profile.rewards] lucky query error', luckyResp.error);
      if (starResp.error) serverDebug.warn('[profile.rewards] star query error', starResp.error);

      const results: Array<Record<string, unknown>> = [];

      if (mmrResp.data && Array.isArray(mmrResp.data)) {
        for (const r of mmrResp.data as unknown[]) {
          const rr = r as Record<string, unknown>;
          results.push({
            id: rr['id'] ?? null,
            kind: 'milestone',
            description: rr['reward_description'] ?? null,
            cash_amount: rr['cash_amount'] != null ? Number(rr['cash_amount']) : null,
            status: rr['status'] ?? null,
            date: rr['delivered_at'] ?? rr['approved_at'] ?? rr['created_at'] ?? null,
            raw: rr,
          });
        }
      }

      if (podiumResp.data && Array.isArray(podiumResp.data)) {
        for (const r of podiumResp.data as unknown[]) {
          const rr = r as Record<string, unknown>;
          results.push({
            id: rr['id'] ?? null,
            kind: 'podium',
            description: rr['reward_description'] ?? null,
            cash_amount: rr['cash_amount'] != null ? Number(rr['cash_amount']) : null,
            status: rr['status'] ?? null,
            rank: rr['rank'] ?? null,
            date: rr['delivered_at'] ?? rr['created_at'] ?? null,
            raw: rr,
          });
        }
      }

      if (luckyResp.data && Array.isArray(luckyResp.data)) {
        for (const r of luckyResp.data as unknown[]) {
          const rr = r as Record<string, unknown>;
          results.push({
            id: rr['id'] ?? null,
            kind: 'lucky',
            description: rr['reward_description'] ?? null,
            cash_amount: null,
            status: rr['status'] ?? null,
            date: rr['delivered_at'] ?? rr['created_at'] ?? null,
            raw: rr,
          });
        }
      }

      // member_star_awards data
      if (starResp.data && Array.isArray(starResp.data)) {
        for (const r of starResp.data as unknown[]) {
          const rr = r as Record<string, unknown>;
          results.push({
            id: rr['id'] ?? null,
            kind: 'star',
            quantity: rr['stars_awarded'] != null ? Number(rr['stars_awarded']) : 0,
            description: 'Challenge stars',
            date: rr['awarded_at'] ?? null,
            raw: rr,
          });
        }
      }

      // No legacy fallbacks: all reward history is read from canonical tables.

      // Sort by date desc (nulls last)
      results.sort((a, b) => {
        const da = a.date ? new Date(String(a.date)).getTime() : 0;
        const db = b.date ? new Date(String(b.date)).getTime() : 0;
        return db - da;
      });

      return NextResponse.json({ ok: true, data: results });
    } catch (e: unknown) {
      serverDebug.error('[profile.rewards] aggregation exception', String(e));
      const message = e instanceof Error ? e.message : String(e);
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  } catch (err: unknown) {
    serverDebug.error('[profile.rewards] exception', String(err));
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  } finally {
    serverDebug.debug('[profile.rewards] duration_ms:', Date.now() - start);
  }
}
