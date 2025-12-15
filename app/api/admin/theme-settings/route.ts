import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug'
import ensureAdmin from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

async function getServiceClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// use shared `ensureAdmin` helper

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value }, set() {}, remove() {} } }
    );

    const { data: systemSettings } = await supabase.from('system_theme_settings').select('*').maybeSingle();
    const { data: presets } = await supabase.from('theme_presets').select('*').order('name', { ascending: true });

    return NextResponse.json({ systemSettings: systemSettings || null, presets: presets || [] });
  } catch (err: unknown) {
    serverDebug.error('[admin/theme-settings] GET exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });

    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get(name: string) { return request.cookies.get(name)?.value }, set() {}, remove() {} } }
    );
    await ensureAdmin(supabaseAuth);

    const service = await getServiceClient();
    const client = service || supabaseAuth;

    // two actions supported: updateSystemSettings or togglePreset
    if (String(body.action) === 'updateSystem' && body.settings) {
      const settings = body.settings as Record<string, unknown>;
      if (!settings.id) return NextResponse.json({ error: 'Missing id for update' }, { status: 400 });
      const { data, error } = await client.from('system_theme_settings').update(settings).eq('id', settings.id as string).select();
      if (error) {
        serverDebug.error('[admin/theme-settings] updateSystem error', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ updated: data });
    }

    if (String(body.action) === 'togglePreset' && body.id != null && typeof body.is_active === 'boolean') {
      const { data, error } = await client.from('theme_presets').update({ is_active: body.is_active as boolean }).eq('id', body.id as string).select();
      if (error) {
        serverDebug.error('[admin/theme-settings] togglePreset error', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ updated: data });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    serverDebug.error('[admin/theme-settings] POST exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
