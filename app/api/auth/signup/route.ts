import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import serverDebug from '@/lib/server-debug';

export const dynamic = "force-dynamic";

/**
 * API để tạo tài khoản mới trong Supabase Auth
 * POST /api/auth/signup
 * Body: { email, password, full_name }
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as unknown;
    const parsed = (typeof body === 'object' && body) ? body as Record<string, unknown> : {};
    const email = typeof parsed.email === 'string' ? parsed.email : undefined;
    const password = typeof parsed.password === 'string' ? parsed.password : undefined;
    const full_name = typeof parsed.full_name === 'string' ? parsed.full_name : undefined;
    const role = typeof parsed.role === 'string' ? parsed.role : undefined;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email và mật khẩu là bắt buộc" },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Mật khẩu phải có ít nhất 6 ký tự" },
        { status: 400 }
      );
    }

    // Use service role key for admin operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    serverDebug.info("Creating user:", email);

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name || email.split("@")[0],
        },
        emailRedirectTo: undefined, // Skip email confirmation for admin-created accounts
      },
    });

    if (authError) {
      serverDebug.error("Signup error:", authError);
      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    if (!authData.user) {
      return NextResponse.json(
        { error: "Không thể tạo tài khoản" },
        { status: 500 }
      );
    }

    serverDebug.info("User created, creating profile:", authData.user.id);

    // Create/update profile record with role
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: authData.user.id,
      email: email,
      full_name: full_name || email.split("@")[0],
      role: role || "member",
      is_active: true,
      join_date: new Date().toISOString(),
    }, {
      onConflict: "id"
    });

    if (profileError) {
      serverDebug.error("Profile creation error:", profileError);
      return NextResponse.json(
        { error: `Tài khoản đã tạo nhưng profile gặp lỗi: ${profileError.message}` },
        { status: 500 }
      );
    }

    serverDebug.info("Profile created successfully");

    return NextResponse.json({
      ok: true,
      user: authData.user,
      message: "Tài khoản đã được tạo thành công",
    });
  } catch (err: unknown) {
    serverDebug.error("Server error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message || "Lỗi máy chủ" },
      { status: 500 }
    );
  }
}
