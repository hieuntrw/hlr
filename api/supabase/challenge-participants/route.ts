import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    // Require session cookie for service-role queries
    const cookieStore = cookies();
    const hasAuth = Boolean(cookieStore.get('sb-access-token') || cookieStore.get('sb-session') || cookieStore.get('sb-refresh-token'));
    if (!hasAuth) {
      return NextResponse.json({ error: 'Không xác thực' }, { status: 401 });
    }

    const url = new URL(request.url)
    const challengeId = url.searchParams.get('challenge_id')
    const userId = url.searchParams.get('user_id')
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')

    const { createClient } = await import('@supabase/supabase-js')
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: 'Missing supabase config' }, { status: 500 })
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    let query = supabase.from('challenge_participants').select(
      `id,user_id,target_km,actual_km,avg_pace_seconds,total_activities,status,profiles(id,full_name,avatar_url)`
    )

    if (challengeId) query = query.eq('challenge_id', challengeId)
    if (userId) query = query.eq('user_id', userId)
    if (start) query = query.gte('created_at', start)
    if (end) query = query.lte('created_at', end)

    query = query.order('actual_km', { ascending: false })

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
