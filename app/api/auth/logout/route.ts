import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

/**
 * API để logout và xóa session cookies
 * POST /api/auth/logout
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("sb-access-token")?.value;

    if (accessToken) {
      // Use anon key for logout
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      // Sign out from Supabase (invalidate tokens on server)
      await supabase.auth.signOut();
    }

    // Clear cookies regardless of Supabase response
    cookieStore.delete("sb-access-token");
    cookieStore.delete("sb-refresh-token");

    return NextResponse.json({
      ok: true,
      message: "Đã đăng xuất thành công",
    });
  } catch (err: any) {
    console.error("Logout error:", err);
    
    // Still try to clear cookies even on error
    const cookieStore = await cookies();
    cookieStore.delete("sb-access-token");
    cookieStore.delete("sb-refresh-token");
    
    return NextResponse.json({
      ok: true,
      message: "Đã đăng xuất",
    });
  }
}
