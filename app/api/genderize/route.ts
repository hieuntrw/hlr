import { NextResponse, NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ error: 'genderize API disabled' }, { status: 404 });
}
