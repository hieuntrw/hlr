import { getSupabaseServiceClient } from '@/lib/supabase-service-client';
import { cookies } from 'next/headers';
import { decodeSbSessionCookie } from '@/lib/server-auth';

export async function GET() {
  try {
    console.log('[api/finance/recent-expenses] handler start (service client)');

    // Require an auth cookie to be present before allowing service-role queries.
    const cookieStore = cookies();
    const hasAccess = Boolean(cookieStore.get('sb-access-token') || cookieStore.get('sb-session') || cookieStore.get('sb-refresh-token'));
    if (!hasAccess) {
      return new Response(JSON.stringify({ ok: false, error: 'Không xác thực' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    const sbRaw = cookieStore.get('sb-session')?.value ?? cookieStore.get('sb-access-token')?.value;
    const reconstructed = await decodeSbSessionCookie(sbRaw);
    if (!reconstructed) {
      return new Response(JSON.stringify({ ok: false, error: 'Không xác thực' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }

    const svc = getSupabaseServiceClient();
    const q = svc
      .from('view_public_recent_expenses')
      .select('*')
      .order('payment_date', { ascending: false })
      .limit(50);

    const { data, error } = await q;
    if (error) {
      // Try to extract structured fields from Supabase error without using `any`
      const e = error as unknown as { message?: string; code?: string | number; details?: unknown; status?: number };
      const errInfo = {
        message: (typeof e.message === 'string' ? e.message : String(e)),
        code: (e.code ?? e.status) as string | number | null,
        details: e.details ?? null,
      };
      console.error('[api/finance/recent-expenses] svc error:', JSON.stringify(errInfo));
      const status = (String(errInfo.code || '').includes('42501') || String(errInfo.message || '').toLowerCase().includes('permission')) ? 403 : 500;
      return new Response(JSON.stringify({ ok: false, error: errInfo }), { status, headers: { 'content-type': 'application/json' } });
    }

    return new Response(JSON.stringify({ ok: true, data }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (err: unknown) {
    console.error('[api/finance/recent-expenses] error:', err);
    const msg = err && typeof (err as Record<string, unknown>)['message'] === 'string' ? String((err as Record<string, unknown>)['message']) : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
}

export const dynamic = 'force-dynamic';
