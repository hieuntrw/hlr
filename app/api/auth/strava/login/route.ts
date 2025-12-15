import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Deprecated: redirect to new non-auth Strava connect endpoint
  const url = new URL(request.url);
  const redirect = new URL(`/api/strava/connect/login`, url.origin);
  return NextResponse.redirect(redirect);
}
