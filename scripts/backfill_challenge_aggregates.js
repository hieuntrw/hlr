#!/usr/bin/env node
// Backfill cached aggregates for a given challenge id
// Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill_challenge_aggregates.js <challenge_id>

const { createClient } = require('@supabase/supabase-js');

async function main() {
  const challengeId = process.argv[2];
  if (!challengeId) {
    console.error('Usage: node scripts/backfill_challenge_aggregates.js <challenge_id>');
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || process.env.SUPABASE_DOMAIN;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
    process.exit(2);
  }

  const supabase = createClient(url, key);

  console.log('Fetching participants for challenge', challengeId);
  const { data: parts, error: partErr } = await supabase.from('challenge_participants').select('id,user_id,target_km').eq('challenge_id', challengeId);
  if (partErr) {
    console.error('Failed to fetch participants', partErr);
    process.exit(3);
  }
  const participantIds = (parts || []).map(p => p.id).filter(Boolean);
  if (!participantIds.length) {
    console.log('No participants found');
    return;
  }

  console.log('Fetching activities for participants...');
  const { data: acts, error: actErr } = await supabase.from('activities').select('challenge_participant_id,distance,moving_time').in('challenge_participant_id', participantIds);
  if (actErr) {
    console.error('Failed to fetch activities', actErr);
    process.exit(4);
  }

  const byPart = {};
  (acts || []).forEach(a => {
    const pid = a.challenge_participant_id;
    if (!pid) return;
    if (!byPart[pid]) byPart[pid] = { totalMeters: 0, totalSeconds: 0, count: 0 };
    byPart[pid].totalMeters += Number(a.distance || 0);
    byPart[pid].totalSeconds += Number(a.moving_time || 0);
    byPart[pid].count += 1;
  });

  for (const p of parts) {
    const pid = p.id;
    const agg = byPart[pid] || { totalMeters: 0, totalSeconds: 0, count: 0 };
    const totalKm = Math.round((agg.totalMeters / 1000) * 100) / 100;
    const avgPaceSeconds = totalKm > 0 ? Math.round(agg.totalSeconds / totalKm) : null;
    const validActivitiesCount = agg.count;
    const completionRate = p.target_km ? Math.round((totalKm / Number(p.target_km)) * 10000) / 100 : 0;
    const completed = p.target_km ? totalKm >= Number(p.target_km) : false;

    console.log('Updating participant', pid, { totalKm, avgPaceSeconds, validActivitiesCount, completionRate, completed });
    const { error: updErr } = await supabase.from('challenge_participants').update({
      actual_km: totalKm,
      avg_pace_seconds: avgPaceSeconds,
      total_activities: validActivitiesCount,
      last_synced_at: new Date().toISOString(),
      total_km: totalKm,
      valid_activities_count: validActivitiesCount,
      completion_rate: completionRate,
      completed,
      status: completed ? 'completed' : undefined,
    }).eq('id', pid);
    if (updErr) {
      console.error('Failed to update participant', pid, updErr);
    }
  }

  console.log('Backfill completed');
}

main().catch(err => {
  console.error('Fatal', err);
  process.exit(99);
});
