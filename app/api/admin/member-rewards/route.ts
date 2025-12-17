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

    // Optionally filter by race_id or type
    const url = new URL(request.url);
    const type = url.searchParams.get('type');

    // Build and run milestone query
    let mmRows: Array<Record<string, unknown>> | null = null;
    let mmErr: unknown = null;
    {
      const r = await client
        .from('member_milestone_rewards')
        .select('id, member_id, race_id, race_result_id, status, achieved_time_seconds, reward_description, cash_amount, related_transaction_id, profiles(full_name) , reward_milestones(id, milestone_name, reward_description, cash_amount)')
        .order('created_at', { ascending: false });
      mmRows = r.data as Array<Record<string, unknown>> | null;
      mmErr = r.error;
    }

    // Fallback: if no rows returned (or error), try a simple select(*) to diagnose RLS/relational select issues
    if ((!mmRows || mmRows.length === 0) && !mmErr) {
      try {
        const fb = await client.from('member_milestone_rewards').select('*').order('created_at', { ascending: false });
        if (fb.error) serverDebug.warn('Fallback simple select member_milestone_rewards error', fb.error);
        const fbRows = fb.data as Array<Record<string, unknown>> | null;
        if (fbRows && fbRows.length > 0) {
          mmRows = fbRows;
        }
      } catch (e) {
        serverDebug.warn('Fallback select failed for member_milestone_rewards', e);
      }
    }

    // Build and run podium query
    let prRows: Array<Record<string, unknown>> | null = null;
    let prErr: unknown = null;
    {
      const r2 = await client
        .from('member_podium_rewards')
        .select('id, member_id, race_id, race_result_id, status, podium_config_id, reward_description, cash_amount, related_transaction_id, profiles(full_name), reward_podium_config(id, reward_description, cash_amount)')
        .order('created_at', { ascending: false });
      prRows = r2.data as Array<Record<string, unknown>> | null;
      prErr = r2.error;
    }

    // Podium fallback simple select if complex select returned nothing (help with RLS/relational failures)
    if ((!prRows || prRows.length === 0) && !prErr) {
      try {
        const fb2 = await client.from('member_podium_rewards').select('*').order('created_at', { ascending: false });
        if (fb2.error) serverDebug.warn('Fallback simple select member_podium_rewards error', fb2.error);
        const fbRows2 = fb2.data as Array<Record<string, unknown>> | null;
        if (fbRows2 && fbRows2.length > 0) {
          prRows = fbRows2;
        }
      } catch (e) {
        serverDebug.warn('Fallback select failed for member_podium_rewards', e);
      }
    }

    if (mmErr) serverDebug.warn('GET member_milestone_rewards error', mmErr);
    if (prErr) serverDebug.warn('GET member_podium_rewards error', prErr);

    // If the client requested only lucky or star items, return them now
    if (type === 'lucky') {
      const rLucky = await client
        .from('lucky_draw_winners')
        .select('id, member_id, status, challenge_id,reward_description, related_transaction_id, created_at, profiles(full_name)')
        .order('created_at', { ascending: false });
      if (rLucky.error) serverDebug.warn('GET lucky_draw_winners error', rLucky.error);
      const rows = rLucky.data as Array<Record<string, unknown>> | null;
      const memberIds = new Set<string>();
      (rows || []).forEach((x) => { if (x && x.member_id) memberIds.add(String(x.member_id)); });
      const profileMap: Record<string, Record<string, unknown>> = {};
      if (memberIds.size > 0) {
        try {
          const ids = Array.from(memberIds);
          const { data: profiles } = await client.from('profiles').select('id, full_name').in('id', ids);
          (profiles || []).forEach((p) => { profileMap[String((p as Record<string, unknown>).id ?? '')] = p as Record<string, unknown>; });
        } catch (e) {
          serverDebug.warn('Failed to fetch profiles for lucky winners', e);
        }
      }
      const out: Array<Record<string, unknown>> = [];
      (rows || []).forEach((r2) => {
        const rec = r2 as Record<string, unknown>;
        if (!rec.profiles) rec.profiles = profileMap[String(rec.member_id ?? '')] ?? null;
        out.push({ __type: 'lucky', ...rec });
      });
      return NextResponse.json({ data: out });
    }

    if (type === 'star') {
      const rStar = await client
        .from('member_star_awards')
        .select('id, user_id, challenge_participant_id, stars_awarded, awarded_by, created_at, profiles(full_name)')
        .order('created_at', { ascending: false });
      if (rStar.error) serverDebug.warn('GET member_star_awards error', rStar.error);
      const rows = rStar.data as Array<Record<string, unknown>> | null;
      const memberIds = new Set<string>();
      (rows || []).forEach((x) => { if (x && x.member_id) memberIds.add(String(x.member_id)); });
      const profileMap: Record<string, Record<string, unknown>> = {};
      if (memberIds.size > 0) {
        try {
          const ids = Array.from(memberIds);
          const { data: profiles } = await client.from('profiles').select('id, full_name').in('id', ids);
          (profiles || []).forEach((p) => { profileMap[String((p as Record<string, unknown>).id ?? '')] = p as Record<string, unknown>; });
        } catch (e) {
          serverDebug.warn('Failed to fetch profiles for star awards', e);
        }
      }
      const out: Array<Record<string, unknown>> = [];
      (rows || []).forEach((r2) => {
        const rec = r2 as Record<string, unknown>;
        if (!rec.profiles) rec.profiles = profileMap[String(rec.member_id ?? '')] ?? null;
        out.push({ __type: 'star', ...rec });
      });
      return NextResponse.json({ data: out });
    }

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

    // If caller requested only milestone or podium rows, return them separately
    if (type === 'milestone') {
      const out: Array<Record<string, unknown>> = [];
      (mmRows || []).forEach((r) => {
        const rec = r as Record<string, unknown>;
        if (!rec.profiles) rec.profiles = profileMap[String(rec.member_id ?? '')] ?? null;
        out.push({ __type: 'milestone', ...rec });
      });
      return NextResponse.json({ data: out });
    }
    if (type === 'podium') {
      const out: Array<Record<string, unknown>> = [];
      (prRows || []).forEach((r) => {
        const rec = r as Record<string, unknown>;
        if (!rec.profiles) rec.profiles = profileMap[String(rec.member_id ?? '')] ?? null;
        out.push({ __type: 'podium', ...rec });
      });
      return NextResponse.json({ data: out });
    }

    // Note: inference from `race_results` removed to avoid unrelated filtering.
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

    // Helper to process a single id across supported reward tables (milestone, podium, lucky, star)
    async function processId(targetId: string) {
      // Try milestone table first
      const { data: mm, error: mmErr } = await client.from('member_milestone_rewards').select('*').eq('id', targetId).maybeSingle();
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
          const { data: updated, error: updErr } = await client.from('member_milestone_rewards').update(payload).eq('id', targetId).select().maybeSingle();
          if (updErr) {
            // Retry without delivered_by if column doesn't exist
            if (/column .*delivered_by.*does not exist/i.test(String(updErr.message || ''))) {
              delete payload['delivered_by'];
              const { data: updated2, error: updErr2 } = await client.from('member_milestone_rewards').update(payload).eq('id', targetId).select().maybeSingle();
              if (updErr2) serverDebug.error('Failed to update member_milestone_rewards (retry)', updErr2);
              return { updated: updated2 };
            }
            serverDebug.error('Failed to update member_milestone_rewards', updErr);
          }
          return { updated };
        } catch (e) {
          serverDebug.error('PUT member_milestone_rewards exception', e);
          return { error: 'Failed to update milestone reward' };
        }
      }

      // Try podium table
      const { data: pr, error: prErr } = await client.from('member_podium_rewards').select('*').eq('id', targetId).maybeSingle();
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
          const { data: updated, error: updErr } = await client.from('member_podium_rewards').update(payload).eq('id', targetId).select().maybeSingle();
          if (updErr) {
            if (/column .*delivered_by.*does not exist/i.test(String(updErr.message || ''))) {
              delete payload['delivered_by'];
              const { data: updated2, error: updErr2 } = await client.from('member_podium_rewards').update(payload).eq('id', targetId).select().maybeSingle();
              if (updErr2) serverDebug.error('Failed to update member_podium_rewards (retry)', updErr2);
              return { updated: updated2 };
            }
            serverDebug.error('Failed to update member_podium_rewards', updErr);
          }
          return { updated };
        } catch (e) {
          serverDebug.error('PUT member_podium_rewards exception', e);
          return { error: 'Failed to update podium reward' };
        }
      }

      // Try lucky draw winners
      const { data: lw, error: lwErr } = await client.from('lucky_draw_winners').select('*').eq('id', targetId).maybeSingle();
      if (lwErr) serverDebug.warn('Error querying lucky_draw_winners', lwErr);
      if (lw) {
        let txnId: string | null = null;
        try {
          const cash = Number((lw as Record<string, unknown>).cash_amount ?? 0);
          if (cash > 0) {
            const { data: tIns, error: tErr } = await client.from('transactions').insert({
              user_id: (lw as Record<string, unknown>).member_id,
              type: 'reward_payout',
              amount: cash,
              description: `Lucky draw payout: ${((lw as Record<string, unknown>).reward_description as string) ?? ''}`,
              transaction_date: new Date().toISOString().slice(0, 10),
              payment_status: 'paid'
            }).select('id').maybeSingle();
            if (!tErr && tIns) txnId = String((tIns as Record<string, unknown>)['id'] ?? null);
          }
        } catch {
          serverDebug.warn('Failed to create transaction for lucky draw payout');
        }

        try {
          const payload: Record<string, unknown> = { ...updates, related_transaction_id: txnId };
          if (deliveredBy) payload['delivered_by'] = deliveredBy;
          const { data: updated, error: updErr } = await client.from('lucky_draw_winners').update(payload).eq('id', targetId).select().maybeSingle();
          if (updErr) {
            if (/column .*delivered_by.*does not exist/i.test(String(updErr.message || ''))) {
              delete payload['delivered_by'];
              const { data: updated2, error: updErr2 } = await client.from('lucky_draw_winners').update(payload).eq('id', targetId).select().maybeSingle();
              if (updErr2) serverDebug.error('Failed to update lucky_draw_winners (retry)', updErr2);
              return { updated: updated2 };
            }
            serverDebug.error('Failed to update lucky_draw_winners', updErr);
          }
          return { updated };
        } catch (e) {
          serverDebug.error('PUT lucky_draw_winners exception', e);
          return { error: 'Failed to update lucky draw winner' };
        }
      }

      // Try star awards (no transaction expected)
      const { data: st, error: stErr } = await client.from('member_star_awards').select('*').eq('id', targetId).maybeSingle();
      if (stErr) serverDebug.warn('Error querying member_star_awards', stErr);
      if (st) {
        try {
          const payload: Record<string, unknown> = { ...updates };
          if (deliveredBy) payload['delivered_by'] = deliveredBy;
          const { data: updated, error: updErr } = await client.from('member_star_awards').update(payload).eq('id', targetId).select().maybeSingle();
          if (updErr) {
            if (/column .*delivered_by.*does not exist/i.test(String(updErr.message || ''))) {
              delete payload['delivered_by'];
              const { data: updated2, error: updErr2 } = await client.from('member_star_awards').update(payload).eq('id', targetId).select().maybeSingle();
              if (updErr2) serverDebug.error('Failed to update member_star_awards (retry)', updErr2);
              return { updated: updated2 };
            }
            serverDebug.error('Failed to update member_star_awards', updErr);
          }
          return { updated };
        } catch (e) {
          serverDebug.error('PUT member_star_awards exception', e);
          return { error: 'Failed to update star award' };
        }
      }

      return { error: 'Reward id not found' };
    }

    // Support bulk delivery: accept `ids: string[]` in request body
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : null;
    if (ids && ids.length > 0) {
      const results = [] as Array<Record<string, unknown>>;
      for (const i of ids) {
        try {
          // process sequentially to avoid race on transactions; could be parallelized if desired
          // eslint-disable-next-line no-await-in-loop
          const res = await processId(i);
          results.push({ id: i, result: res });
        } catch (e) {
          results.push({ id: i, error: String(e) });
        }
      }
      return NextResponse.json({ results });
    }

    // Single id processing
    const singleRes = await processId(id);
    if ((singleRes as Record<string, unknown>).error) {
      return NextResponse.json(singleRes as Record<string, unknown>, { status: 404 });
    }
    return NextResponse.json(singleRes);
  } catch (err: unknown) {
    serverDebug.error('PUT /api/admin/member-rewards exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

