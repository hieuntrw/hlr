import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const userId = url.searchParams.get('user_id')
    const start = url.searchParams.get('start')
    const end = url.searchParams.get('end')
    const limit = url.searchParams.get('limit')

    const { createClient } = await import('@supabase/supabase-js')
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!SUPABASE_URL || !SERVICE_KEY) {
      return NextResponse.json({ error: 'Missing supabase config' }, { status: 500 })
    }
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    let query = supabase
      .from('activities')
      .select(
        'id,name,distance,moving_time,elapsed_time,average_heartrate,average_cadence,total_elevation_gain,start_date,type,map_summary_polyline'
      )

    if (userId) query = query.eq('user_id', userId)
    if (start) query = query.gte('start_date', start)
    if (end) query = query.lte('start_date', end)
    query = query.order('start_date', { ascending: false })
    if (limit) query = query.limit(Number(limit))

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
