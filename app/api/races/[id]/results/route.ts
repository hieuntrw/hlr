import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service-client';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const raceId = params.id;
    const client = getSupabaseServiceClient();
    const { data, error } = await client
      .from('race_results')
      .select(
        `id, user_id, distance, chip_time_seconds, podium_config_id, is_pr, profiles(full_name, avatar_url)`
      )
      .eq('race_id', raceId)
      .order('chip_time_seconds', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
