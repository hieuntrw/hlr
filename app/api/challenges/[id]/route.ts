import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    const { data, error } = await supabase
      .from('challenges')
      .select('id, title, start_date, end_date, description, is_locked, capacity, created_by')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('GET /api/challenges/[id] error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ challenge: data });
  } catch (err: any) {
    console.error('GET /api/challenges/[id] exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
