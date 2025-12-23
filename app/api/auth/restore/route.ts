import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const cookie = request.headers.get('cookie') || '';
    const match = cookie.match(/sb-access-token=([^;\s]+)/);
    if (!match) return NextResponse.json({ ok: false }, { status: 404 });
    const token = decodeURIComponent(match[1]);
    return NextResponse.json({ ok: true, access_token: token });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
