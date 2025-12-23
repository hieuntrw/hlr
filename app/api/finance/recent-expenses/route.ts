export async function GET() {
  try {
    console.log('[api/finance/recent-expenses] handler start');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      console.error('[api/finance/recent-expenses] missing SUPABASE env vars');
      return new Response(JSON.stringify({ ok: false, error: 'Missing SUPABASE_SERVICE config' }), { status: 500 });
    }

    const restUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/view_public_recent_expenses?select=*&order=payment_date.desc&limit=50`;
    console.log('[api/finance/recent-expenses] restUrl:', restUrl);
    const sk = (serviceKey || '').toString().replace(/\s+/g, '');
    const r = await fetch(restUrl, {
      headers: {
        apikey: sk,
        'x-api-key': sk,
      },
    });
    console.log('[api/finance/recent-expenses] supabase status:', r.status);
    const txt = await r.text();
    if (!r.ok) {
      return new Response(JSON.stringify({ ok: false, error: txt }), { status: r.status });
    }

    const data = JSON.parse(txt || 'null');
    return new Response(JSON.stringify({ ok: true, data }), { status: 200 });
  } catch (err: unknown) {
    console.error('[api/finance/recent-expenses] error:', err);
    const msg = err && typeof (err as Record<string, unknown>)['message'] === 'string' ? String((err as Record<string, unknown>)['message']) : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
