import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import serverDebug from '@/lib/server-debug';
import { requireAdminFromRequest } from '@/lib/admin-auth';

export async function POST(req: NextRequest) {
  try {
    const bodyRaw = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const userId = typeof bodyRaw.userId === 'string' ? bodyRaw.userId : undefined;
    const role = typeof bodyRaw.role === 'string' ? bodyRaw.role : undefined;
    const fullName = typeof bodyRaw.fullName === 'string' ? bodyRaw.fullName : undefined;

    serverDebug.info("[Update User API] Request:", { userId, role, fullName });

    // Ensure caller is admin via shared helper (handles sb-session fallback)
    try {
      const { user, role: callerRole } = await requireAdminFromRequest((name: string) => req.cookies.get(name)?.value);
      serverDebug.debug('[Update User API] Current user:', user?.email);
      serverDebug.debug('[Update User API] Current user role (app_metadata):', callerRole);
      if (callerRole !== 'admin') return NextResponse.json({ error: 'Không có quyền' }, { status: 403 });
    } catch (e: unknown) {
      const err = e as Record<string, unknown> | null;
      serverDebug.warn('[Update User API] requireAdminFromRequest failed', err);
      const status = err && typeof err['status'] === 'number' ? (err['status'] as number) : 401;
      const message = err && typeof err['message'] === 'string' ? (err['message'] as string) : 'Không xác thực';
      return NextResponse.json({ error: message }, { status });
    }

    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 });

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role } as Record<string, unknown>,
      user_metadata: {} as Record<string, unknown>,
    });

    try {
      const { error: profileErr } = await supabaseAdmin.from('profiles').upsert({ id: userId, full_name: fullName || null }, { onConflict: 'id' });
      if (profileErr) serverDebug.warn('[Update User API] Failed to upsert profiles.full_name', profileErr);
    } catch (e) {
      serverDebug.warn('[Update User API] Exception upserting profile full_name', String(e));
    }

    if (updateError) {
      serverDebug.error('[Update User API] Update error:', updateError);
      const msg = (updateError as { message?: string })?.message ?? String(updateError);
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    serverDebug.error('[Update User API] Exception:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message || 'Lỗi server' }, { status: 500 });
  }
}
