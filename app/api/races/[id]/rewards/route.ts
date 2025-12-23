import { NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabase-service-client';

export async function GET() {
  try {
    const client = getSupabaseServiceClient();
    const { data, error } = await client
      .from('reward_definitions')
      .select('id, category, type, condition_value, condition_label, prize_description, cash_amount')
      .order('category', { ascending: true })
      .order('priority_level', { ascending: true });
    if (error) {
      const errObj = error as unknown as Record<string, unknown>;
      const message = String(errObj?.message ?? '');
      if (errObj?.code === 'PGRST205' || /Could not find the table/.test(message)) {
        return NextResponse.json({ ok: true, data: [] });
      }
      throw error;
    }
    return NextResponse.json({ ok: true, data });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
