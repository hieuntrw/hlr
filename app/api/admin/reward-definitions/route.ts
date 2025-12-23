import { NextResponse } from 'next/server';

// Legacy endpoint removed: reward_definitions table no longer exists.
// Keep a lightweight route that returns 410 Gone for all methods so callers
// receive a clear signal that the API was intentionally removed.

export const dynamic = 'force-dynamic';

function goneResponse() {
  return NextResponse.json({ ok: false, error: 'Removed: reward_definitions is deprecated' }, { status: 410 });
}

export async function GET() {
  return goneResponse();
}

export async function POST() {
  return goneResponse();
}

export async function PUT() {
  return goneResponse();
}

export async function DELETE() {
  return goneResponse();
}
