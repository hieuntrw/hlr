import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, role, fullName, phoneNumber, dob, gender, deviceName, joinDate, pbHmSeconds, pbFmSeconds } = body;

    console.log("[Create User API] Request body:", { email, role, fullName, phoneNumber, dob, gender, deviceName, joinDate, pbHmSeconds, pbFmSeconds, hasPassword: !!password });

    // Validate required fields
    if (!email || !password) {
      console.log("[Create User API] Missing required fields");
      return NextResponse.json({ error: "Email và mật khẩu là bắt buộc" }, { status: 400 });
    }

    if (password.length < 6) {
      console.log("[Create User API] Password too short");
      return NextResponse.json({ error: "Mật khẩu phải có ít nhất 6 ký tự" }, { status: 400 });
    }

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

    // Kiểm tra quyền admin từ session hiện tại
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    console.log("[Create User API] Current user:", user?.email);
    console.log("[Create User API] Current user role:", user?.user_metadata?.role);

    if (userError || !user) {
      console.log("[Create User API] Auth error:", userError);
      return NextResponse.json({ error: "Không xác thực" }, { status: 401 });
    }

    const currentUserRole = user.user_metadata?.role;
    if (currentUserRole !== "admin") {
      console.log("[Create User API] Not admin, role:", currentUserRole);
      return NextResponse.json({ error: "Chỉ admin được phép" }, { status: 403 });
    }

    // Tạo service role client để tạo user mới
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    console.log("[Create User API] Creating new user...");

    // Tạo user mới trong Supabase Auth với mật khẩu nhập từ form
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, fullName },
    });

    if (createError || !newUser?.user) {
      console.log("[Create User API] Create error:", createError);
      return NextResponse.json({ error: createError?.message || "Tạo user thất bại" }, { status: 400 });
    }

    console.log("[Create User API] User created:", newUser.user.id);

    // Tạo bản ghi profiles
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: newUser.user.id,
      email,
      full_name: fullName,
      role,
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
      console.log("[Create User API] Profile error:", profileError);
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    console.log("[Create User API] Success!");
    return NextResponse.json({ success: true, userId: newUser.user.id });
  } catch (err: any) {
    console.error("[Create User API] Exception:", err);
    return NextResponse.json({ error: err.message || "Lỗi server" }, { status: 500 });
  }
}
