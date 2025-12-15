#!/usr/bin/env node
// Backfill script: assign eligible activities to existing challenge_participants
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill_assign_activities_to_participants.js [--apply]

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const APPLY = process.argv.includes('--apply');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function fetchParticipants(page = 0, perPage = 200) {
  const from = page * perPage;
  const to = from + perPage - 1;
  const { data, error } = await supabase
    .from('challenge_participants')
    .select('id, user_id, challenge_id')
    .range(from, to);
  if (error) throw error;
  return data || [];
}

function toVNStartISO(dateStr) {
  // dateStr e.g., 2025-12-01
  return `${dateStr}T00:00:00+07:00`;
}
function toVNEndISO(dateStr) {
  return `${dateStr}T23:59:59+07:00`;
}

(async function main() {
  console.log('Backfill assign activities to existing participants');
  console.log(APPLY ? 'Mode: APPLY (will write changes)' : 'Mode: DRY-RUN (no writes)');

  let page = 0;
  const perPage = 200;
  let totalProcessed = 0;
  while (true) {
    const parts = await fetchParticipants(page, perPage);
    if (!parts || parts.length === 0) break;

    for (const p of parts) {
      try {
        totalProcessed++;
        console.log(`\n[${totalProcessed}] Participant ${p.id} user=${p.user_id} challenge=${p.challenge_id}`);

        // fetch challenge
        const { data: ch, error: chErr } = await supabase
          .from('challenges')
          .select('id, start_date, end_date, min_pace_seconds, max_pace_seconds, min_km, require_map')
          .eq('id', p.challenge_id)
          .limit(1)
          .single();

        if (chErr || !ch) {
          console.warn('  - challenge lookup failed', chErr?.message || 'not found');
          continue;
        }

        const startISO = toVNStartISO(ch.start_date);
        const endISO = toVNEndISO(ch.end_date);

        // candidate activities: same user, no participant assigned, start_date within bounds
        const { data: acts, error: actsErr } = await supabase
          .from('activities')
          .select('id, distance, moving_time, start_date, type, map_summary_polyline')
          .eq('user_id', p.user_id)
          .is('challenge_participant_id', null)
          .gte('start_date', startISO)
          .lte('start_date', endISO)
          .limit(1000);

        if (actsErr) {
          console.warn('  - activities query failed', actsErr.message);
          continue;
        }

        const minMeters = (ch.min_km ?? 1) * 1000;
        const requireMap = !!ch.require_map;
        const minPace = ch.min_pace_seconds ?? 240;
        const maxPace = ch.max_pace_seconds ?? 720;

        const eligibleIds = [];
        for (const a of acts || []) {
          // type filter
          if (a.type && a.type !== 'Run' && a.type !== 'Walk') continue;

          // map requirement
          if (requireMap && (!a.map_summary_polyline || a.map_summary_polyline === '')) continue;

          // distance requirement
          if (!a.distance || Number(a.distance) < minMeters) continue;

          // pace requirement (moving_time/distance_in_km)
          if (a.distance && Number(a.distance) > 0) {
            const pace = Number(a.moving_time || 0) / (Number(a.distance) / 1000);
            if (pace < minPace || pace > maxPace) continue;
          }

          eligibleIds.push(a.id);
        }

        console.log(`  - candidates: ${acts?.length || 0}, eligible: ${eligibleIds.length}`);

        if (eligibleIds.length > 0 && APPLY) {
          // perform update
          const { error: upErr } = await supabase
            .from('activities')
            .update({ challenge_participant_id: p.id })
            .in('id', eligibleIds);
          if (upErr) {
            console.error('  - failed to assign activities:', upErr.message);
            continue;
          }

          // recompute aggregates
          const { data: aggRows, error: aggErr } = await supabase
            .from('activities')
            .select('distance,moving_time')
            .eq('challenge_participant_id', p.id);
          if (aggErr) {
            console.warn('  - failed to fetch assigned activities for aggregates', aggErr.message);
            continue;
          }

          const totalMeters = (aggRows || []).reduce((s, r) => s + (Number(r.distance) || 0), 0);
          const totalKm = Math.round((totalMeters / 1000) * 100) / 100;
          const totalSeconds = (aggRows || []).reduce((s, r) => s + (Number(r.moving_time) || 0), 0);
          const totalActivities = (aggRows || []).length;
          const avgPace = totalKm > 0 ? Math.round(totalSeconds / totalKm) : 0;

          const { error: updErr } = await supabase
            .from('challenge_participants')
            .update({ actual_km: totalKm, avg_pace_seconds: avgPace, total_activities: totalActivities, last_synced_at: new Date().toISOString() })
            .eq('id', p.id);

          if (updErr) {
            console.error('  - failed to update participant aggregates:', updErr.message);
          } else {
            console.log('  - assigned and updated aggregates');
          }
        } else if (eligibleIds.length > 0 && !APPLY) {
          console.log('  - DRY RUN: would assign ids:', eligibleIds.slice(0, 20).join(', '), eligibleIds.length > 20 ? '...' : '');
        }
      } catch (err) {
        console.error('  - unexpected error for participant', p.id, err.message || err);
      }
    }

    page += 1;
  }

  console.log('\nDone. Processed participants:', totalProcessed);
})();
