import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug'

export const dynamic = 'force-dynamic';

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
          set() {},
          remove() {},
        },
      }
    );

    const { data, error } = await supabaseAuth
      .from('lucky_draw_winners')
      .select('id, member_id, reward_description, status, member:profiles(full_name)')
      .eq('challenge_id', id)
      .not('member_id', 'is', null)
      .order('created_at', { ascending: true });

    if (error) {
      serverDebug.error('GET /api/challenges/[id]/lucky-draws error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []).map((d: unknown) => {
      const dd = d as Record<string, unknown>;
      return {
        id: dd.id,
        winner_user_id: dd.member_id,
        prize_name: dd.reward_description,
        status: dd.status,
        winner_profile: dd.member || null,
      };
    });

    // Return first 2 winners
    return NextResponse.json({ winners: rows.slice(0, 2) });
  } catch (err: unknown) {
    serverDebug.error('GET /api/challenges/[id]/lucky-draws exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
