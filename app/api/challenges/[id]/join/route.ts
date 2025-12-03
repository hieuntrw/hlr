import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const body = await request.json();
    const { user_id, target_km } = body;
    if (!user_id || !target_km) {
      return NextResponse.json({ error: 'user_id and target_km required' }, { status: 400 });
    }

    // Insert participant if not exists
    const { data: existing } = await supabase
      .from('challenge_participants')
      .select('id')
      .eq('challenge_id', id)
      .eq('user_id', user_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ message: 'Already joined' });
    }

    const { data, error } = await supabase
      .from('challenge_participants')
      .insert([
        { challenge_id: id, user_id, target_km }
      ]);

    if (error) {
      console.error('POST /api/challenges/[id]/join error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ participant: data?.[0] });
  } catch (err: any) {
    console.error('POST /api/challenges/[id]/join exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
