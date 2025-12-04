#!/usr/bin/env node
// Smoke test for recalc_challenge_participant_aggregates RPC
// If env vars SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided, this script
// will POST to the RPC endpoint for a given challenge id and print the result.

const fetch = globalThis.fetch || require('node-fetch');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const challengeId = process.argv[2];

  if (!challengeId) {
    console.error('Usage: node scripts/smoke_recalc_rpc.js <challenge_id>');
    process.exit(1);
  }

  if (!url || !key) {
    console.log('SUPABASE URL or SERVICE ROLE KEY not provided.');
    console.log('This script can only run against a live Supabase project with service role key.');
    console.log('Example:');
    console.log('  NEXT_PUBLIC_SUPABASE_URL=https://<proj>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/smoke_recalc_rpc.js <challenge_id>');
    process.exit(0);
  }

  const rpcUrl = (url.replace(/\/$/, '')) + '/rpc/recalc_challenge_participant_aggregates';

  console.log('Calling RPC:', rpcUrl);

  try {
    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_challenge_id: challengeId, p_participant_id: null }),
    });

    const text = await resp.text();
    console.log('Status:', resp.status);
    console.log('Response:', text);
    if (!resp.ok) process.exit(2);
  } catch (err) {
    console.error('Error calling RPC:', err);
    process.exit(3);
  }
}

main();
