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

    // Fetch race and attempt to fetch only unprocessed race_results (status = false).
    // If the `status` column doesn't exist (older schema), fallback to fetching all results.
    const { data: raceRow } = await service.from('races').select('id, race_date').eq('id', raceId).maybeSingle();
    let results: Array<Record<string, unknown>> | null = null;
    // Try to query only where status = false
    try {
      const q = await service
        .from('race_results')
        .select('id, user_id, distance, chip_time_seconds, podium_config_id')
        .eq('race_id', raceId)
        .eq('status', false);
      if (q.error) {
        // If error mentions missing column, fallback below
        if (!/column .*status.*does not exist/i.test(String(q.error.message || ''))) {
          serverDebug.error('Failed to fetch race_results with status filter', q.error);
          return NextResponse.json({ error: q.error.message }, { status: 500 });
        }
      } else {
        results = q.data as Array<Record<string, unknown>>;
      }
    } catch {
      // ignore and fallback
      results = null;
    }

    if (!results) {
      const { data: allResults, error: resErr } = await service
        .from('race_results')
        .select('id, user_id, distance, chip_time_seconds, podium_config_id')
        .eq('race_id', raceId);
      if (resErr) {
        serverDebug.error('Failed to fetch race_results', resErr);
        return NextResponse.json({ error: resErr.message }, { status: 500 });
      }
      results = allResults as Array<Record<string, unknown>>;
    }

    const summary: Array<Record<string, unknown>> = [];

    // Auto-deliver feature disabled: always create pending transactions and set rewards pending.
    // quick bail if no results
    if (!results || results.length === 0) {
      return NextResponse.json({ ok: true, processed: summary });
    }

    // Bulk fetch profiles for validation and PB checks
    const userIds = (results || []).map((r: Record<string, unknown>) => (r.user_id as string)).filter(Boolean);
    const { data: profiles } = await service
      .from('profiles')
      .select('id, full_name, gender, pb_hm_seconds, pb_fm_seconds')
      .in('id', userIds);
    const profileMap: Record<string, Record<string, unknown>> = {};
    (profiles || []).forEach((p: Record<string, unknown>) => {
      const pid = String((p as Record<string, unknown>)['id'] ?? '');
      profileMap[pid] = p as Record<string, unknown>;
    });

    // 1) Validate participant completeness
    const invalid: Array<Record<string, string>> = [];
    for (const r of (results || [])) {
      const rec = r as Record<string, unknown>;
      const prof = profileMap[String(rec.user_id)];
      const chip = Number(rec.chip_time_seconds || 0);
      const rid = String(rec['id'] ?? '');
      if (!prof || !prof.full_name) invalid.push({ id: rid, reason: 'missing_full_name' });
      if (!prof || !prof.gender) invalid.push({ id: rid, reason: 'missing_gender' });
      if (!rec.distance) invalid.push({ id: rid, reason: 'missing_distance' });
      if (!chip || chip <= 0) invalid.push({ id: rid, reason: 'missing_chip_time' });
    }
    if (invalid.length > 0) {
      return NextResponse.json({ error: 'Incomplete participant data', details: invalid }, { status: 400 });
    }

    // For PB/history updates we may need race_date
    const raceDate = String((raceRow as Record<string, unknown>)?.race_date ?? new Date().toISOString().slice(0,10));

    for (const r of (results || [])) {
      const rRec = r as Record<string, unknown>;
      const category = getRaceCategory(rRec.distance as string);
      const userId = String(rRec.user_id);
      const prof = profileMap[userId] || ({} as Record<string, unknown>);

      // 2) Check PR against profile PBs and update pb_history + profile
      if (category) {
        const pbField = category === 'HM' ? 'pb_hm_seconds' : 'pb_fm_seconds';
        const approvalField = category === 'HM' ? 'pb_hm_approved' : 'pb_fm_approved';
        const currentPB = prof[pbField] ?? null;
        const chip = Number(rRec.chip_time_seconds || 0);
        const isNewPB = !currentPB || (chip > 0 && chip < Number(currentPB));
        if (isNewPB) {
          // update profile PB (mark pending approval)
          const updatePayload: Record<string, unknown> = {};
          updatePayload[pbField] = chip;
          updatePayload[approvalField] = false;
          const { error: pErr } = await service.from('profiles').update(updatePayload).eq('id', userId);
          if (pErr) serverDebug.warn('Failed to update profile PB', pErr);

          // insert into pb_history
          const achievedAt = new Date(String(raceDate)).toISOString().slice(0,10);
          const { error: histErr } = await service.from('pb_history').insert({
            user_id: userId,
            distance: category,
            time_seconds: chip,
            achieved_at: achievedAt,
            race_id: raceId,
          });
          if (histErr) serverDebug.warn('Failed to insert pb_history', histErr);

          // mark race_result as PR
          const { error: prErr } = await service.from('race_results').update({ is_pr: true }).eq('id', rRec.id);
          if (prErr) serverDebug.warn('Failed to mark race_result is_pr', prErr);
        }
      }

      // 3) Time-based milestone reward (only when category determined)
      if (category) {
        const { data: milestones } = await service
          .from('reward_milestones')
          .select('id, reward_description, cash_amount, priority, time_seconds, race_type')
          .eq('race_type', category)
          .in('gender', [prof.gender as string | null, null])
          .eq('is_active', true)
          .order('priority', { ascending: false });

        if (milestones && milestones.length > 0) {
          const chip = Number(rRec.chip_time_seconds);
          const found = (milestones as Array<Record<string, unknown>>).find((m) => {
            const t = Number((m as Record<string, unknown>).time_seconds as unknown);
            if (Number.isNaN(chip) || typeof t !== 'number') return false;
            return chip <= t;
          }) as Record<string, unknown> | undefined;

          if (found) {
            // Check duplicates: user already has this milestone
            const { data: existingSame } = await service
              .from('member_milestone_rewards')
              .select('id')
              .eq('member_id', userId)
              .eq('milestone_id', found.id)
              .limit(1);

            if (existingSame && existingSame.length > 0) {
              serverDebug.debug('User already has this milestone, skipping', { userId, milestone: found.id });
            } else {
              // Check if user already has a milestone for same race_type with priority >= found.priority
              // fetch user's existing milestone_ids, then query reward_milestones for max priority
              const { data: mmRows } = await service
                .from('member_milestone_rewards')
                .select('milestone_id')
                .eq('member_id', userId);

              let skipDueToHigher = false;
              if (mmRows && mmRows.length > 0) {
                const milestoneIds = (mmRows as Array<Record<string, unknown>>).map((r) => String(r.milestone_id ?? '')).filter(Boolean);
                if (milestoneIds.length > 0) {
                  const { data: existingMilestones } = await service
                    .from('reward_milestones')
                    .select('id, priority')
                    .in('id', milestoneIds)
                    .eq('race_type', (found as Record<string, unknown>).race_type as string)
                    .order('priority', { ascending: false })
                    .limit(1);

                  if (existingMilestones && existingMilestones.length > 0) {
                    const maxPriority = Number((existingMilestones[0].priority as unknown) || 0);
                    if (maxPriority >= Number((found as Record<string, unknown>).priority || 0)) skipDueToHigher = true;
                  }
                }
              }

              if (skipDueToHigher) {
                serverDebug.debug('Existing milestone with higher/equal priority present, skip awarding lower', { userId, foundPriority: found.priority });
              } else {
                // If there is cash, create transaction first so we can link it
                let relatedTxnId: string | null = null;
                // Always create pending transactions and set reward status to 'pending'
                if ((found as Record<string, unknown>).cash_amount && Number((found as Record<string, unknown>).cash_amount) > 0) {
                  const { data: txnIns, error: txnErr } = await service.from('transactions').insert({
                    user_id: userId,
                    type: 'reward_payout',
                    amount: (found as Record<string, unknown>).cash_amount,
                    description: `Milestone reward: ${(found as Record<string, unknown>).reward_description as string}`,
                    transaction_date: new Date().toISOString().slice(0,10),
                    payment_status: 'pending'
                  }).select('id').maybeSingle();
                  if (txnErr) {
                    serverDebug.warn('Failed to create transaction for milestone', txnErr);
                  } else if (txnIns) {
                    const maybeId = (txnIns as Record<string, unknown>)['id'];
                    relatedTxnId = typeof maybeId === 'undefined' || maybeId === null ? null : String(maybeId);
                  }
                }

                const ins = await service.from('member_milestone_rewards').insert({
                  member_id: userId,
                  race_id: raceId,
                  race_result_id: rRec.id as string,
                  milestone_id: found.id,
                  achieved_time_seconds: rRec.chip_time_seconds,
                  reward_description: found.reward_description,
                  cash_amount: found.cash_amount,
                  status: 'pending',
                  delivered_at: null,
                  related_transaction_id: relatedTxnId,
                }).select('id').maybeSingle();

                if (ins.error) {
                  serverDebug.warn('Could not insert member_milestone_rewards', ins.error);
                } else {
                  summary.push({ race_result_id: rRec.id, milestone_awarded: found.id, related_transaction_id: relatedTxnId });
                }
              }
            }
          }
        }
      }

      // 4) Podium rewards: honor preselected podium_config_id if present
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
          // Always create pending transactions and set reward status to 'pending'
          if ((podCfg as Record<string, unknown>).cash_amount && Number((podCfg as Record<string, unknown>).cash_amount) > 0) {
            const { data: txnIns, error: txnErr } = await service.from('transactions').insert({
              user_id: userId,
              type: 'reward_payout',
              amount: (podCfg as Record<string, unknown>).cash_amount,
              description: `Podium reward (preselected): ${(podCfg as Record<string, unknown>).reward_description as string}`,
              transaction_date: new Date().toISOString().slice(0,10),
              payment_status: 'pending'
            }).select('id').maybeSingle();
            if (txnErr) serverDebug.warn('Failed to create transaction for podium', txnErr);
            else if (txnIns) {
              const maybeId = (txnIns as Record<string, unknown>)['id'];
              relatedPodTxnId = typeof maybeId === 'undefined' || maybeId === null ? null : String(maybeId);
            }
          }

          const ins = await service.from('member_podium_rewards').insert({
            member_id: userId,
            race_id: raceId,
            race_result_id: rRec.id as string,
            podium_config_id: (podCfg as Record<string, unknown>).id,
            podium_type: (podCfg as Record<string, unknown>).podium_type,
            rank: (podCfg as Record<string, unknown>).rank,
            reward_description: (podCfg as Record<string, unknown>).reward_description,
            cash_amount: (podCfg as Record<string, unknown>).cash_amount,
            status: 'pending',
            delivered_at: null,
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

    // 5) Mark race_results as processed where possible (set status = true) — ignore if column absent
    try {
      await service.from('race_results').update({ status: true }).eq('race_id', raceId);
    } catch {
      // ignore — column may not exist
    }

    // Optionally mark race record as having processed results (if column exists)
    try {
      await service.from('races').update({ results_finalized: true }).eq('id', raceId);
    } catch {
      // ignore if column absent
    }

    return NextResponse.json({ ok: true, processed: summary });
  } catch (err: unknown) {
    serverDebug.error('Exception in process-results route', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    const message = (err as Record<string, unknown>)?.message || String(err);
    return NextResponse.json({ error: message }, { status: typeof status === 'number' ? status : 500 });
  }
}
