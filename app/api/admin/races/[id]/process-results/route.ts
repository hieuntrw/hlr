import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';

function getRaceCategory(distance: string): 'HM' | 'FM' | null {
  const d = (distance || '').toLowerCase();
  if (d.includes('21')) return 'HM';
  if (d.includes('42')) return 'FM';
  return null;
}

export async function POST(request: NextRequest) {
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
      serverDebug.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Extract race id from URL path as fallback to body
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    // expected: /api/admin/races/:id/process-results
    const raceId = pathParts[3] || (await request.json().catch(() => ({}))).race_id;
    if (!raceId) return NextResponse.json({ error: 'race_id required' }, { status: 400 });

    // Fetch race results for this race
    const { data: results, error: resErr } = await service
      .from('race_results')
      .select('id, user_id, distance, chip_time_seconds, podium_config_id')
      .eq('race_id', raceId);

    if (resErr) {
      serverDebug.error('Failed to fetch race_results', resErr);
      return NextResponse.json({ error: resErr.message }, { status: 500 });
    }

    const summary: Array<Record<string, unknown>> = [];

    for (const r of (results || [])) {
      const rRec = r as Record<string, unknown>;
      const category = getRaceCategory(rRec.distance as string);
      // Fetch user gender
      const userId = rRec.user_id as string;
      const { data: profile } = await service.from('profiles').select('gender').eq('id', userId).single();
      const gender = (profile as Record<string, unknown> | null)?.gender || null;

      // 1) Time-based milestone reward
      if (category) {
        const { data: milestones } = await service
          .from('reward_milestones')
          .select('id, reward_description, cash_amount, priority, time_seconds')
          .eq('race_type', category)
          .in('gender', [gender, null])
          .eq('is_active', true)
          .order('priority', { ascending: false });

        if (milestones && milestones.length > 0) {
          // pick highest priority that meets time threshold (priority desc)
          const chip = Number(rRec.chip_time_seconds);
          const found = milestones.find((m) => {
            const t = (m as Record<string, unknown>).time_seconds;
            if (typeof t !== 'number' || Number.isNaN(chip)) return false;
            return chip <= t;
          }) as Record<string, unknown> | undefined;
          if (found) {
            // If there is cash, create transaction first so we can link it
            let relatedTxnId: string | null = null;
            if (found.cash_amount && Number(found.cash_amount) > 0) {
              const { data: txnIns, error: txnErr } = await service.from('transactions').insert({
                user_id: rRec.user_id as string,
                type: 'reward_payout',
                amount: found.cash_amount,
                description: `Milestone reward: ${found.reward_description as string}`,
                transaction_date: new Date().toISOString().slice(0,10),
                payment_status: 'pending'
              }).select('id').maybeSingle();
              if (txnErr) {
                serverDebug.warn('Failed to create transaction for milestone', txnErr);
              } else {
                relatedTxnId = (txnIns as Record<string, unknown> | null)?.id as string ?? null;
              }
            }

            const ins = await service.from('member_milestone_rewards').insert({
              member_id: rRec.user_id as string,
              race_id: raceId,
              race_result_id: rRec.id as string,
              milestone_id: found.id,
              achieved_time_seconds: rRec.chip_time_seconds,
              reward_description: found.reward_description,
              cash_amount: found.cash_amount,
              status: 'pending',
              related_transaction_id: relatedTxnId,
            }).select('id').maybeSingle();

            if (ins.error) {
              serverDebug.warn('Could not insert member_milestone_rewards', ins.error);
              // If we created a transaction but failed to insert reward, we keep txn for manual reconciliation
            } else {
              summary.push({ race_result_id: rRec.id, milestone_awarded: found.id, related_transaction_id: relatedTxnId });
            }
          }
        }
      }

      // 2) Podium rewards: overall an/d age_group
        // 2) Podium rewards
        // If admin pre-selected a podium config on the race_result, honor it first.
        if (rRec.podium_config_id) {
          const podId = String(rRec.podium_config_id);
          const { data: podCfg, error: podErr } = await service
            .from('reward_podium_config')
            .select('id, reward_description, cash_amount, podium_type, rank')
            .eq('id', podId)
            .maybeSingle();

          if (podErr) {
            serverDebug.warn('Failed to fetch podium config', podErr);
          } else if (podCfg) {
            let relatedPodTxnId: string | null = null;
            if ((podCfg as Record<string, unknown>).cash_amount && Number((podCfg as Record<string, unknown>).cash_amount) > 0) {
              const { data: txnIns, error: txnErr } = await service.from('transactions').insert({
                user_id: rRec.user_id as string,
                type: 'reward_payout',
                amount: (podCfg as Record<string, unknown>).cash_amount,
                description: `Podium reward (preselected): ${(podCfg as Record<string, unknown>).reward_description as string}`,
                transaction_date: new Date().toISOString().slice(0,10),
                payment_status: 'pending'
              }).select('id').maybeSingle();
              if (txnErr) serverDebug.warn('Failed to create transaction for podium', txnErr);
              else relatedPodTxnId = (txnIns as Record<string, unknown> | null)?.id as string ?? null;
            }

            const ins = await service.from('member_podium_rewards').insert({
              member_id: rRec.user_id as string,
              race_id: raceId,
              race_result_id: rRec.id as string,
              podium_config_id: (podCfg as Record<string, unknown>).id,
              podium_type: (podCfg as Record<string, unknown>).podium_type,
              rank: (podCfg as Record<string, unknown>).rank,
              reward_description: (podCfg as Record<string, unknown>).reward_description,
              cash_amount: (podCfg as Record<string, unknown>).cash_amount,
              status: 'pending',
              related_transaction_id: relatedPodTxnId,
            }).select('id').maybeSingle();

            if (ins.error) {
              serverDebug.warn('Could not insert member_podium_rewards (preselected)', ins.error);
            } else {
              summary.push({ race_result_id: rRec.id, podium_awarded: (podCfg as Record<string, unknown>).id, podium_type: (podCfg as Record<string, unknown>).podium_type, rank: (podCfg as Record<string, unknown>).rank, related_transaction_id: relatedPodTxnId });
            }
          }
        }
    }

    return NextResponse.json({ ok: true, processed: summary });
    } catch (err: unknown) {
      serverDebug.error('Exception in process-results route', err);
      const status = (err as Record<string, unknown>)?.status || 500;
      const message = (err as Record<string, unknown>)?.message || String(err);
      return NextResponse.json({ error: message }, { status: typeof status === 'number' ? status : 500 });
    }
}
