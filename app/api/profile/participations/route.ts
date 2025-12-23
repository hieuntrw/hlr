import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service-client';
import { cookies } from 'next/headers';
import { decodeSbSessionCookie } from '@/lib/server-auth';

export async function GET(req: Request) {
  try {
    // Optional year param
    const url = new URL(req.url);
    const year = url.searchParams.get('year') || String(new Date().getFullYear());

    // Try to get user id from sb-session cookie fallback
    const cookieStore = cookies();
    const sb = cookieStore.get('sb-session')?.value ?? null;
    const user = sb ? await decodeSbSessionCookie(sb) : null;
    if (!user || !user.id) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

    const client = getSupabaseServiceClient();
    const { data, error } = await client
      .from('view_user_yearly_km_stats')
      .select('*')
      .eq('user_id', user.id)
      .eq('report_year', Number(year));

    if (error) {
      let message = String(error);
      try {
        const serial = JSON.stringify(error, Object.getOwnPropertyNames(error));
        message = serial;
      } catch {
        const errObj = error as unknown as { message?: unknown };
        const maybeMsg = (errObj && typeof errObj === 'object' && 'message' in errObj)
          ? String(errObj.message)
          : undefined;
        message = maybeMsg ?? String(error);
      }
      console.error('[api/profile/participations] supabase error (serialized):', message);
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
