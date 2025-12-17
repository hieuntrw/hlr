import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

// We now aggregate reward history from specialized tables instead of relying
// primarily on legacy `member_rewards`. Keep minimal fallback for legacy rows.

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

    const initial = await supabase.auth.getUser();
    let user = initial.data.user;
    let error: unknown = initial.error;

    const acc = cookieStore.get('sb-access-token')?.value;
    const ref = cookieStore.get('sb-refresh-token')?.value;
    if (!user && (acc || ref)) {
      try {
        if (acc && ref) {
          await supabase.auth.setSession({ access_token: acc, refresh_token: ref });
          const retry = await supabase.auth.getUser();
          user = retry.data.user;
          error = retry.error;
        } else {
          serverDebug.debug('[profile.rewards] incomplete auth cookies; skipping setSession');
        }
      } catch (e: unknown) {
        serverDebug.debug('[profile.rewards] setSession failed', String(e));
      }
    }

    if (error) {
      const msg = (error as { message?: string }).message ?? String(error);
      return NextResponse.json({ ok: false, error: msg }, { status: 200 });
    }
    if (!user) return NextResponse.json({ ok: false, error: 'No user' }, { status: 401 });

    // Aggregate from the canonical reward tables: milestone, podium, lucky draws.
    try {
      const [mmrResp, podiumResp, luckyResp, legacyResp] = await Promise.all([
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
        // Minimal legacy fallback: include challenge-star rows and any legacy lucky-draw rows
        supabase
          .from('member_rewards')
          .select('id, reward_type, quantity, reward_definition_id, challenge_id, awarded_date, status, created_at')
          .eq('user_id', user.id)
          .or('quantity.not.is.null,reward_definition_id.not.is.null'),
      ]);

      if (mmrResp.error) serverDebug.warn('[profile.rewards] mmr query error', mmrResp.error);
      if (podiumResp.error) serverDebug.warn('[profile.rewards] podium query error', podiumResp.error);
      if (luckyResp.error) serverDebug.warn('[profile.rewards] lucky query error', luckyResp.error);
      if (legacyResp.error) serverDebug.warn('[profile.rewards] legacy member_rewards query error', legacyResp.error);

      const results: Array<Record<string, unknown>> = [];

      if (mmrResp.data) {
        for (const r of mmrResp.data as any[]) {
          results.push({
            id: r.id,
            kind: 'milestone',
            description: r.reward_description,
            cash_amount: r.cash_amount,
            status: r.status,
            date: r.delivered_at || r.approved_at || r.created_at,
            raw: r,
          });
        }
      }

      if (podiumResp.data) {
        for (const r of podiumResp.data as any[]) {
          results.push({
            id: r.id,
            kind: 'podium',
            description: r.reward_description,
            cash_amount: r.cash_amount,
            status: r.status,
            rank: r.rank,
            date: r.delivered_at || r.created_at,
            raw: r,
          });
        }
      }

      if (luckyResp.data) {
        for (const r of luckyResp.data as any[]) {
          results.push({
            id: r.id,
            kind: 'lucky',
            description: r.reward_description,
            cash_amount: null,
            status: r.status,
            date: r.delivered_at || r.created_at,
            raw: r,
          });
        }
      }

      if (legacyResp.data) {
        for (const r of legacyResp.data as any[]) {
          if (r.quantity != null) {
            results.push({
              id: r.id,
              kind: 'star',
              quantity: r.quantity,
              description: 'Challenge stars',
              status: r.status,
              date: r.awarded_date || r.created_at,
              raw: r,
            });
          } else if (r.reward_definition_id != null) {
            // Legacy lucky-draw stored via reward_definition_id — surface as legacy_lucky
            results.push({
              id: r.id,
              kind: 'legacy_lucky',
              reward_definition_id: r.reward_definition_id,
              description: 'Legacy lucky-draw prize',
              status: r.status,
              date: r.awarded_date || r.created_at,
              raw: r,
            });
          }
        }
      }

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
