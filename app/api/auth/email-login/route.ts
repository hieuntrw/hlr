import { NextRequest, NextResponse } from "next/server";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email và mật khẩu là bắt buộc" },
        { status: 400 }
      );
    }

    const supabase = createRouteHandlerClient({ cookies });

    console.log("Attempting login for:", email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("Login error:", error);
      return NextResponse.json(
        { error: `${error.message}. Đảm bảo tài khoản đã được tạo qua Supabase Auth.` },
        { status: 401 }
      );
    }

    console.log("Login successful for:", data.user?.email);

    // Get user's profile to return role information
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", data.user.id)
      .single();

    return NextResponse.json({
      ok: true,
      user: {
        ...data.user,
        role: profile?.role || "member",
        full_name: profile?.full_name,
      },
    });
  } catch (err: any) {
    console.error("Server error:", err);
    return NextResponse.json(
      { error: err?.message || "Lỗi máy chủ" },
      { status: 500 }
    );
  }
}
