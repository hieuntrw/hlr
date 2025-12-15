import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import serverDebug from '@/lib/server-debug'

export const dynamic = "force-dynamic";

/**
 * API để logout và xóa session cookies
 * POST /api/auth/logout
 */
export async function POST() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;

    if (accessToken) {
      // Invalidate session server-side by calling Supabase's logout endpoint
      // with the user's access token. This revokes the session without
      // relying on the client-side SDK types.
      try {
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
            "Content-Type": "application/json",
          },
        });
      } catch (fetchErr) {
        serverDebug.warn("Supabase logout endpoint call failed:", fetchErr);
      }
    }

    // Clear cookies regardless of Supabase response
    cookieStore.delete("sb-access-token");
    cookieStore.delete("sb-refresh-token");

    return NextResponse.json({
      ok: true,
      message: "Đã đăng xuất thành công",
    });
  } catch (err: unknown) {
    serverDebug.error("Logout error:", err);

    // Still try to clear cookies even on error
    const cookieStore = await cookies();
    cookieStore.delete("sb-access-token");
    cookieStore.delete("sb-refresh-token");

    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: true,
      message: message || "Đã đăng xuất",
    });
  }
}
