import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {
            /* no-op on server route */
          },
          remove() {
            /* no-op on server route */
          },
        },
      }
    );

    // Ensure challenge exists
    const { data: challengeRow, error: challengeErr } = await supabaseAuth
      .from('challenges')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (challengeErr) {
      console.error('GET /api/challenges/[id]/participants fetch challenge error', challengeErr);
      return NextResponse.json({ error: 'Không thể lấy thông tin thử thách' }, { status: 500 });
    }

    if (!challengeRow) {
      return NextResponse.json({ error: 'Không tìm thấy thử thách' }, { status: 404 });
    }

    const { data, error } = await supabaseAuth
      .from('challenge_participants')
      .select(
        `user_id, target_km, actual_km, avg_pace_seconds, total_activities, status, profiles(full_name, avatar_url)`
      )
      .eq('challenge_id', id)
      .order('actual_km', { ascending: false });

    if (error) {
      console.error('GET /api/challenges/[id]/participants error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const participants = (data || []).map((p: any) => ({
      user_id: p.user_id,
      target_km: p.target_km,
      actual_km: p.actual_km,
      avg_pace_seconds: p.avg_pace_seconds,
      total_activities: p.total_activities,
      status: p.status,
      profile: p.profiles,
    }));

    return NextResponse.json({ participants });
  } catch (err: any) {
    console.error('GET /api/challenges/[id]/participants exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
