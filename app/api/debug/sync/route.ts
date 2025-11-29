import { NextRequest, NextResponse } from "next/server";
import { syncUserActivities } from "@/lib/services/stravaService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const userId = url.searchParams.get("userId");
  const month = Number(url.searchParams.get("month") || 0);
  const year = Number(url.searchParams.get("year") || 0);
  const run = url.searchParams.get("run") === "1";

  if (!userId || !month || !year) {
    return NextResponse.json(
      {
        error:
          "Usage: /api/debug/sync?userId=<uuid>&month=<1-12>&year=<YYYY>&run=1 (run=1 to execute)",
      },
      { status: 400 }
    );
  }

  const allow = process.env.ALLOW_DEBUG_SYNC === "1";
  if (run && !allow) {
    return NextResponse.json(
      {
        error:
          "Debug sync disabled. Set ALLOW_DEBUG_SYNC=1 in .env.local to enable running this endpoint.",
      },
      { status: 403 }
    );
  }

  try {
    if (!run) {
      return NextResponse.json({ ok: true, message: "Dry-run mode. Add &run=1 to execute." });
    }

    const result = await syncUserActivities(userId, month, year);
    return NextResponse.json({ ok: true, result });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || String(err) }, { status: 500 });
  }
}
