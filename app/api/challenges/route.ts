import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase-client';

export async function GET(request: Request) {
  try {
    const { data, error } = await supabase
      .from('challenges')
      .select('id, title, start_date, end_date, description, is_locked, capacity')
      .order('start_date', { ascending: false });

    if (error) {
      console.error('GET /api/challenges error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ challenges: data });
  } catch (err: any) {
    console.error('GET /api/challenges exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
