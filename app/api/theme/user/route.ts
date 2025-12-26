import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service-client';
import { cookies } from 'next/headers';

export async function GET(req: Request) {
  try {
    // Require session cookie for theme preference access
    const cookieStore = cookies();
    const hasAuth = Boolean(cookieStore.get('sb-access-token') || cookieStore.get('sb-session') || cookieStore.get('sb-refresh-token'));
    if (!hasAuth) {
      return NextResponse.json({ ok: false, error: 'Không xác thực' }, { status: 401 });
    }

    const url = new URL(req.url);
    const userId = url.searchParams.get('userId');
    if (!userId) return NextResponse.json({ ok: false, error: 'missing userId' }, { status: 400 });
    const client = getSupabaseServiceClient();
    const { data, error } = await client
      .from('user_theme_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return NextResponse.json({ ok: true, data: data ?? null });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    // Require session cookie for theme preference update
    const cookieStore = cookies();
    const hasAuth = Boolean(cookieStore.get('sb-access-token') || cookieStore.get('sb-session') || cookieStore.get('sb-refresh-token'));
    if (!hasAuth) {
      return NextResponse.json({ ok: false, error: 'Không xác thực' }, { status: 401 });
    }

    const body = await req.json();
    const { userId, preference } = body;
    if (!userId || !preference) return NextResponse.json({ ok: false, error: 'missing body' }, { status: 400 });
    const client = getSupabaseServiceClient();
    const up = {
      user_id: userId,
      theme_id: preference.theme_id ?? null,
      custom_colors: preference.custom_colors ?? null,
      custom_fonts: preference.custom_fonts ?? null,
      custom_spacing: preference.custom_spacing ?? null,
      dark_mode_enabled: Boolean(preference.dark_mode_enabled),
      use_system_theme: Boolean(preference.use_system_theme),
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from('user_theme_preferences').upsert(up, { onConflict: 'user_id' });
    if (error) throw error;
    // Optionally increment usage
    if (preference.theme_id) {
      try {
        await client.rpc('increment_theme_usage', { theme_id: preference.theme_id });
      } catch {
        // ignore
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
