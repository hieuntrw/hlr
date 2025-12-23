import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service-client';

export async function GET() {
  try {
    const client = getSupabaseServiceClient();
    const { data, error } = await client
      .from('theme_presets')
      .select('*')
      .eq('is_active', true)
      .order('is_system', { ascending: false })
      .order('usage_count', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
