import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug'
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

// Using shared `ensureAdmin` from `lib/server-auth`

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

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

    const client = service || supabaseAuth;

    // Optionally filter by race_id
    const url = new URL(request.url);
    const raceId = url.searchParams.get('race_id');

    // Build and run milestone query (avoid `any` by branching)
    let mmRows: Array<Record<string, unknown>> | null = null;
    let mmErr: unknown = null;
    if (raceId) {
      // To handle rows where `race_id` may not have been populated, also include rewards
      // whose `race_result_id` belongs to the given race.
      const rByRace = await client
        .from('member_milestone_rewards')
        .select('id, member_id, race_id, race_result_id, status, achieved_time_seconds, reward_description, cash_amount, related_transaction_id, profiles(full_name) , reward_milestones(id, milestone_name, reward_description, cash_amount)')
        .eq('status', 'pending')
        .eq('race_id', raceId)
        .order('created_at', { ascending: false });
      mmRows = rByRace.data as Array<Record<string, unknown>> | null;
      mmErr = rByRace.error;

      try {
        const rr = await client.from('race_results').select('id').eq('race_id', raceId);
        const rrIds = (rr.data || []).map((x) => String(((x as Record<string, unknown>)['id']) ?? ''));
        if (rrIds.length > 0) {
          const rByResult = await client
            .from('member_milestone_rewards')
            .select('id, member_id, race_id, race_result_id, status, achieved_time_seconds, reward_description, cash_amount, related_transaction_id, profiles(full_name) , reward_milestones(id, milestone_name, reward_description, cash_amount)')
            .eq('status', 'pending')
            .in('race_result_id', rrIds)
            .order('created_at', { ascending: false });
          const addRows = rByResult.data as Array<Record<string, unknown>> | null;
          if (addRows && addRows.length > 0) {
            const map = new Map<string, Record<string, unknown>>();
            (mmRows || []).forEach((r) => { map.set(String(r.id), r); });
            addRows.forEach((r) => { map.set(String(r.id), r); });
            mmRows = Array.from(map.values());
          }
          if (rByResult.error) mmErr = rByResult.error;
        }
      } catch (e) {
        serverDebug.warn('Failed to include rewards by race_result_id', e);
      }
    } else {
      const r = await client
        .from('member_milestone_rewards')
        .select('id, member_id, race_id, race_result_id, status, achieved_time_seconds, reward_description, cash_amount, related_transaction_id, profiles(full_name) , reward_milestones(id, milestone_name, reward_description, cash_amount)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      mmRows = r.data as Array<Record<string, unknown>> | null;
      mmErr = r.error;
    }

    // Build and run podium query
    // Build and run podium query (avoid `any` by branching)
    let prRows: Array<Record<string, unknown>> | null = null;
    let prErr: unknown = null;
    if (raceId) {
      const r2ByRace = await client
        .from('member_podium_rewards')
        .select('id, member_id, race_id, race_result_id, status, podium_config_id, reward_description, cash_amount, related_transaction_id, profiles(full_name), reward_podium_config(id, reward_description, cash_amount)')
        .eq('status', 'pending')
        .eq('race_id', raceId)
        .order('created_at', { ascending: false });
      prRows = r2ByRace.data as Array<Record<string, unknown>> | null;
      prErr = r2ByRace.error;

      try {
        const rr = await client.from('race_results').select('id').eq('race_id', raceId);
        const rrIds = (rr.data || []).map((x) => String(((x as Record<string, unknown>)['id']) ?? ''));
        if (rrIds.length > 0) {
          const r2ByResult = await client
            .from('member_podium_rewards')
            .select('id, member_id, race_id, race_result_id, status, podium_config_id, reward_description, cash_amount, related_transaction_id, profiles(full_name), reward_podium_config(id, reward_description, cash_amount)')
            .eq('status', 'pending')
            .in('race_result_id', rrIds)
            .order('created_at', { ascending: false });
          const addRows = r2ByResult.data as Array<Record<string, unknown>> | null;
          if (addRows && addRows.length > 0) {
            const map = new Map<string, Record<string, unknown>>();
            (prRows || []).forEach((r) => { map.set(String(r.id), r); });
            addRows.forEach((r) => { map.set(String(r.id), r); });
            prRows = Array.from(map.values());
          }
          if (r2ByResult.error) prErr = r2ByResult.error;
        }
      } catch (e) {
        serverDebug.warn('Failed to include podium rewards by race_result_id', e);
      }
    } else {
      const r2 = await client
        .from('member_podium_rewards')
        .select('id, member_id, race_id, race_result_id, status, podium_config_id, reward_description, cash_amount, related_transaction_id, profiles(full_name), reward_podium_config(id, reward_description, cash_amount)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      prRows = r2.data as Array<Record<string, unknown>> | null;
      prErr = r2.error;
    }

    if (mmErr) serverDebug.warn('GET member_milestone_rewards error', mmErr);
    if (prErr) serverDebug.warn('GET member_podium_rewards error', prErr);

    // Ensure member profile is attached for each row (fallback if DB relation not configured)
    const memberIds = new Set<string>();
    (mmRows || []).forEach((r) => { if (r && r.member_id) memberIds.add(String(r.member_id)); });
    (prRows || []).forEach((r) => { if (r && r.member_id) memberIds.add(String(r.member_id)); });

    const profileMap: Record<string, Record<string, unknown>> = {};
    if (memberIds.size > 0) {
      const ids = Array.from(memberIds);
      try {
        const { data: profiles } = await client.from('profiles').select('id, full_name, gender').in('id', ids);
        (profiles || []).forEach((p) => { profileMap[String((p as Record<string, unknown>).id ?? '')] = p as Record<string, unknown>; });
      } catch (e) {
        serverDebug.warn('Failed to fetch profiles for member rewards', e);
      }
    }

    const combined: Array<Record<string, unknown>> = [];
    (mmRows || []).forEach((r) => {
      const rec = r as Record<string, unknown>;
      if (!rec.profiles) rec.profiles = profileMap[String(rec.member_id ?? '')] ?? null;
      combined.push({ __type: 'milestone', ...rec });
    });
    (prRows || []).forEach((r) => {
      const rec = r as Record<string, unknown>;
      if (!rec.profiles) rec.profiles = profileMap[String(rec.member_id ?? '')] ?? null;
      combined.push({ __type: 'podium', ...rec });
    });

    // Fallback: if nothing in member_* tables, infer podium items from race_results
    if ((!combined || combined.length === 0) && raceId) {
      try {
        const rr = await client.from('race_results').select('id,user_id,podium_config_id,chip_time_seconds').eq('race_id', raceId).not('podium_config_id', 'is', null);
        const rrData = rr.data as Array<Record<string, unknown>> | null;
        if (rrData && rrData.length > 0) {
          const userIds = Array.from(new Set(rrData.map((r) => String(r.user_id))));
          const podiumIds = Array.from(new Set(rrData.map((r) => String(r.podium_config_id))));

          const { data: profs } = await client.from('profiles').select('id,full_name,gender').in('id', userIds);
          const profMap: Record<string, Record<string, unknown>> = {};
          (profs || []).forEach((p) => { profMap[String((p as Record<string, unknown>).id ?? '')] = p as Record<string, unknown>; });

          const { data: podiumCfgs } = await client.from('reward_podium_config').select('id,reward_description,prize_description,cash_amount').in('id', podiumIds);
          const podiumMap: Record<string, Record<string, unknown>> = {};
          (podiumCfgs || []).forEach((p) => { podiumMap[String((p as Record<string, unknown>).id ?? '')] = p as Record<string, unknown>; });

          rrData.forEach((r) => {
            const rec: Record<string, unknown> = {
              id: `inferred-${String(r.id)}`,
              member_id: r.user_id,
              race_id: raceId,
              race_result_id: r.id,
              status: 'pending',
              podium_config_id: r.podium_config_id,
              reward_description: podiumMap[String(r.podium_config_id ?? '')]?.reward_description ?? podiumMap[String(r.podium_config_id ?? '')]?.prize_description ?? null,
              cash_amount: podiumMap[String(r.podium_config_id ?? '')]?.cash_amount ?? 0,
              profiles: profMap[String(r.user_id ?? '')] ?? null,
            };
            combined.push({ __type: 'podium', ...rec });
          });
        }
      } catch (e) {
        serverDebug.warn('Failed to infer podium rewards from race_results', e);
      }
    }

    return NextResponse.json({ data: combined });
  } catch (err: unknown) {
    serverDebug.error('GET /api/admin/member-rewards exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function PUT(request: NextRequest) {
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

    const body = await request.json().catch(() => null);
    if (!body || !body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    const id = String(body.id);
    const updates = body.updates || { status: 'delivered', delivered_at: new Date().toISOString() };
    const deliveredBy = body.delivered_by ?? null;

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

    const client = service || supabaseAuth;

    // Try milestone table first
    const { data: mm, error: mmErr } = await client.from('member_milestone_rewards').select('*').eq('id', id).maybeSingle();
    if (mmErr) serverDebug.warn('Error querying member_milestone_rewards', mmErr);

    if (mm) {
      let txnId: string | null = null;
      try {
        const cash = Number((mm as Record<string, unknown>).cash_amount ?? 0);
        if (cash > 0) {
          const { data: tIns, error: tErr } = await client.from('transactions').insert({
            user_id: (mm as Record<string, unknown>).member_id,
            type: 'reward_payout',
            amount: cash,
            description: `Milestone payout: ${((mm as Record<string, unknown>).reward_description as string) ?? ''}`,
            transaction_date: new Date().toISOString().slice(0, 10),
            payment_status: 'paid'
          }).select('id').maybeSingle();
          if (!tErr && tIns) txnId = String((tIns as Record<string, unknown>)['id'] ?? null);
        }
      } catch {
        serverDebug.warn('Failed to create transaction for milestone payout');
      }

      try {
        const payload: Record<string, unknown> = { ...updates, related_transaction_id: txnId };
        if (deliveredBy) payload['delivered_by'] = deliveredBy;
        const { data: updated, error: updErr } = await client.from('member_milestone_rewards').update(payload).eq('id', id).select().maybeSingle();
        if (updErr) {
          // Retry without delivered_by if column doesn't exist
          if (/column .*delivered_by.*does not exist/i.test(String(updErr.message || ''))) {
            delete payload['delivered_by'];
            const { data: updated2, error: updErr2 } = await client.from('member_milestone_rewards').update(payload).eq('id', id).select().maybeSingle();
            if (updErr2) serverDebug.error('Failed to update member_milestone_rewards (retry)', updErr2);
            return NextResponse.json({ updated: updated2 });
          }
          serverDebug.error('Failed to update member_milestone_rewards', updErr);
        }
        return NextResponse.json({ updated });
      } catch (e) {
        serverDebug.error('PUT member_milestone_rewards exception', e);
        return NextResponse.json({ error: 'Failed to update milestone reward' }, { status: 500 });
      }
    }

    // Try podium table
    const { data: pr, error: prErr } = await client.from('member_podium_rewards').select('*').eq('id', id).maybeSingle();
    if (prErr) serverDebug.warn('Error querying member_podium_rewards', prErr);

    if (pr) {
      let txnId: string | null = null;
      try {
        const cash = Number((pr as Record<string, unknown>).cash_amount ?? 0);
        if (cash > 0) {
          const { data: tIns, error: tErr } = await client.from('transactions').insert({
            user_id: (pr as Record<string, unknown>).member_id,
            type: 'reward_payout',
            amount: cash,
            description: `Podium payout: ${((pr as Record<string, unknown>).reward_description as string) ?? ''}`,
            transaction_date: new Date().toISOString().slice(0, 10),
            payment_status: 'paid'
          }).select('id').maybeSingle();
          if (!tErr && tIns) txnId = String((tIns as Record<string, unknown>)['id'] ?? null);
        }
      } catch {
        serverDebug.warn('Failed to create transaction for podium payout');
      }

      try {
        const payload: Record<string, unknown> = { ...updates, related_transaction_id: txnId };
        if (deliveredBy) payload['delivered_by'] = deliveredBy;
        const { data: updated, error: updErr } = await client.from('member_podium_rewards').update(payload).eq('id', id).select().maybeSingle();
        if (updErr) {
          if (/column .*delivered_by.*does not exist/i.test(String(updErr.message || ''))) {
            delete payload['delivered_by'];
            const { data: updated2, error: updErr2 } = await client.from('member_podium_rewards').update(payload).eq('id', id).select().maybeSingle();
            if (updErr2) serverDebug.error('Failed to update member_podium_rewards (retry)', updErr2);
            return NextResponse.json({ updated: updated2 });
          }
          serverDebug.error('Failed to update member_podium_rewards', updErr);
        }
        return NextResponse.json({ updated });
      } catch (e) {
        serverDebug.error('PUT member_podium_rewards exception', e);
        return NextResponse.json({ error: 'Failed to update podium reward' }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Reward id not found' }, { status: 404 });
  } catch (err: unknown) {
    serverDebug.error('PUT /api/admin/member-rewards exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

