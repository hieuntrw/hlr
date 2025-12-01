import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

    // Use anon key for authentication
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

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

    // Set access token cookie for middleware authentication
    const cookieStore = await cookies();
    if (data.session?.access_token) {
      console.log("Setting sb-access-token cookie...");
      console.log("NODE_ENV:", process.env.NODE_ENV);
      
      cookieStore.set("sb-access-token", data.session.access_token, {
        httpOnly: true,
        secure: false, // Always false in development to work with http://localhost
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: "/",
      });

      // Also set refresh token
      if (data.session?.refresh_token) {
        console.log("Setting sb-refresh-token cookie...");
        cookieStore.set("sb-refresh-token", data.session.refresh_token, {
          httpOnly: true,
          secure: false, // Always false in development
          sameSite: "lax",
          maxAge: 60 * 60 * 24 * 30, // 30 days
          path: "/",
        });
      }
      console.log("Cookies set successfully");
    } else {
      console.warn("No access token in session!");
    }

    console.log("Returning success response with user:", data.user.email);
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
