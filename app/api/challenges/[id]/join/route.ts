import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    // Create server supabase client to read session from cookies
    const res = NextResponse.next();
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

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Không xác thực' }, { status: 401 });
    }

    const body = await request.json();
    const { target_km, password: providedPassword } = body;
    if (!target_km) {
      return NextResponse.json({ error: 'target_km required' }, { status: 400 });
    }

    // Validate challenge existence and password server-side to prevent client bypass
    const { data: challengeRow, error: challengeErr } = await supabaseAuth
      .from('challenges')
      .select('is_locked')
      .eq('id', id)
      .maybeSingle();

    if (challengeErr) {
      console.error('POST /api/challenges/[id]/join fetch challenge error', challengeErr);
      return NextResponse.json({ error: 'Không thể lấy thông tin thử thách' }, { status: 500 });
    }

    if (!challengeRow) {
      return NextResponse.json({ error: 'Không tìm thấy thử thách' }, { status: 404 });
    }

    if (challengeRow.is_locked) {
      return NextResponse.json({ error: 'Thử thách đã bị khoá, không thể đăng ký', }, { status: 403 });
    }

    // Passwords are deprecated; do not require a password to join

    const user_id = user.id;

    // Insert participant if not exists
    const { data: existing, error: existingErr } = await supabaseAuth
      .from('challenge_participants')
      .select('id')
      .eq('challenge_id', id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (existingErr) {
      console.error('POST /api/challenges/[id]/join existing check error', existingErr);
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    if (existing) {
      // Update existing participation's target_km
      const { data: updated, error: updateErr } = await supabaseAuth
        .from('challenge_participants')
        .update({ target_km })
        .eq('id', existing.id)
        .select()
        .maybeSingle();

      if (updateErr) {
        console.error('POST /api/challenges/[id]/join update error', updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ participant: updated });
    }

    const { data, error } = await supabaseAuth
      .from('challenge_participants')
      .insert([
        { challenge_id: id, user_id, target_km }
      ])
      .select()
      .maybeSingle();

    if (error) {
      console.error('POST /api/challenges/[id]/join error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ participant: data });
  } catch (err: any) {
    console.error('POST /api/challenges/[id]/join exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
