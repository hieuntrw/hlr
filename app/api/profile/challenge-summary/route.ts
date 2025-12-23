import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service-client';
import { cookies } from 'next/headers';
import { decodeSbSessionCookie } from '@/lib/server-auth';

export async function GET() {
  try {
    const cookieStore = cookies();
    const sb = cookieStore.get('sb-session')?.value ?? null;
    const user = sb ? await decodeSbSessionCookie(sb) : null;
    if (!user || !user.id) return NextResponse.json({ ok: false, error: 'unauthenticated' }, { status: 401 });

    const client = getSupabaseServiceClient();
    const { data, error } = await client
      .from('view_user_challenge_summary')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
