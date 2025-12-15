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
      .from('lucky_draws')
      .select('id, winner_user_id, prize_name, rank, profiles!lucky_draws_winner_user_id_fkey(full_name)')
      .eq('challenge_id', id)
      .not('winner_user_id', 'is', null);

    if (error) {
      serverDebug.error('GET /api/challenges/[id]/lucky-draws error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data || []).map((d: unknown) => {
      const dd = d as Record<string, unknown>;
      return {
        id: dd.id,
        winner_user_id: dd.winner_user_id,
        prize_name: dd.prize_name,
        rank: dd.rank,
        winner_profile: dd.profiles || null,
      };
    });

    // Sort in JS by numeric rank to avoid server-side ORDER BY issues
    rows.sort((a: Record<string, unknown>, b: Record<string, unknown>) => (Number(a.rank as unknown as number) || 0) - (Number(b.rank as unknown as number) || 0));

    // Return top 2 winners as the client expects
    return NextResponse.json({ winners: rows.slice(0, 2) });
  } catch (err: unknown) {
    serverDebug.error('GET /api/challenges/[id]/lucky-draws exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
