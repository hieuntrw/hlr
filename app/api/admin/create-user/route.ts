import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import serverDebug from '@/lib/server-debug'
import { requireAdminFromRequest } from '@/lib/admin-auth';
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, role, fullName, phoneNumber, dob, gender, deviceName, joinDate, pbHmSeconds, pbFmSeconds } = body;

    serverDebug.debug("[Create User API] Request body:", { email, role, fullName, phoneNumber, dob, gender, deviceName, joinDate, pbHmSeconds, pbFmSeconds, hasPassword: !!password });

    // Validate required fields
    if (!email || !password) {
      serverDebug.debug("[Create User API] Missing required fields");
      return NextResponse.json({ error: "Email và mật khẩu là bắt buộc" }, { status: 400 });
    }

    if (password.length < 6) {
      serverDebug.debug("[Create User API] Password too short");
      return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự" }, { status: 400 });
    }

    // response placeholder if cookies need to be set on redirect flows (not used currently)

    // Ensure caller is admin via shared helper
    try {
      const { user, role } = await requireAdminFromRequest((name: string) => req.cookies.get(name)?.value);
      serverDebug.debug('[Create User API] Authorized user id:', user?.id);
      serverDebug.debug('[Create User API] Current user role (app_metadata):', role);
    } catch (e: unknown) {
      const err = e as unknown as Record<string, unknown>;
      serverDebug.warn('[Create User API] requireAdminFromRequest failed', err);
      const status = (err as Record<string, any>)?.status ?? 401;
      const message = (err as Record<string, any>)?.message ?? 'Không xác thực';
      return NextResponse.json({ error: message }, { status });
    }

    // Tạo service role client để tạo user mới
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    serverDebug.debug("[Create User API] Creating new user...");

    // Tạo user mới trong Supabase Auth với mật khẩu nhập từ form
    // Store role in app_metadata only. Do NOT store role in user_metadata.
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role },
      user_metadata: { },
    });

    if (createError || !newUser?.user) {
      serverDebug.error("[Create User API] Create error:", createError);
      const msg = (createError as { message?: string })?.message ?? String(createError);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    serverDebug.debug("[Create User API] User created:", newUser.user.id);

    // Tạo bản ghi profiles (full_name stored here; role is stored in auth.app_metadata)
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: newUser.user.id,
      email,
      full_name: fullName,
      phone_number: phoneNumber || null,
      dob: dob || null,
      gender: gender || null,
      device_name: deviceName || null,
      join_date: joinDate || new Date().toISOString().split('T')[0],
      pb_hm_seconds: pbHmSeconds || null,
      pb_fm_seconds: pbFmSeconds || null,
      pb_hm_approved: pbHmSeconds ? true : false, // Auto-approve if admin enters
      pb_fm_approved: pbFmSeconds ? true : false, // Auto-approve if admin enters
    });

    if (profileError) {
      serverDebug.error("[Create User API] Profile error:", profileError);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    serverDebug.debug("[Create User API] Success!");
    return NextResponse.json({ success: true, userId: newUser.user.id });
  } catch (err: unknown) {
    serverDebug.error("[Create User API] Exception:", err);
    return NextResponse.json({ error: (err as Record<string, unknown>).message || "Lỗi server" }, { status: 500 });
  }
}
