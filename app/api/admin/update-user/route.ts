import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, role, fullName } = body;

    console.log("[Update User API] Request:", { userId, role, fullName });

    // Create server client to get current user session
    let response = NextResponse.next();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            response.cookies.set({ name, value, ...options });
          },
          remove(name: string, options: any) {
            response.cookies.set({ name, value: "", ...options });
          },
        },
      }
    );

    // Kiểm tra quyền admin
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.log("[Update User API] Auth error:", userError);
      return NextResponse.json({ error: "Không xác thực" }, { status: 401 });
    }

    const currentUserRole = user.user_metadata?.role;
    if (currentUserRole !== "admin") {
      console.log("[Update User API] Not admin, role:", currentUserRole);
      return NextResponse.json({ error: "Chỉ admin được phép" }, { status: 403 });
    }

    // Tạo service role client để update user
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Update user metadata
    const { data: updatedUser, error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: { role, fullName },
      }
    );

    if (updateError) {
      console.log("[Update User API] Update error:", updateError);
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    console.log("[Update User API] Success!");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("[Update User API] Exception:", err);
    return NextResponse.json({ error: err.message || "Lỗi server" }, { status: 500 });
  }
}
