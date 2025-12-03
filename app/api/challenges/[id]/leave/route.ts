import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const body = await request.json();
    const { user_id } = body;
    if (!user_id) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('challenge_participants')
      .delete()
      .eq('challenge_id', id)
      .eq('user_id', user_id);

    if (error) {
      console.error('POST /api/challenges/[id]/leave error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Left challenge' });
  } catch (err: any) {
    console.error('POST /api/challenges/[id]/leave exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
