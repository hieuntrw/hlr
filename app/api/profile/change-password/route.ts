import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as { oldPassword?: string; newPassword?: string } | null;
    if (!body || !body.newPassword || !body.oldPassword) return NextResponse.json({ ok: false, error: 'Missing oldPassword or newPassword' }, { status: 400 });
    const newPassword = String(body.newPassword);

    // Strength: at least 7 chars, include uppercase, lowercase and number
    if (newPassword.length < 7) return NextResponse.json({ ok: false, error: 'Mật khẩu phải có ít nhất 7 ký tự' }, { status: 400 });
    if (!/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      return NextResponse.json({ ok: false, error: 'Mật khẩu phải chứa chữ hoa, chữ thường và số' }, { status: 400 });
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {},
          remove() {},
        },
      }
    );

    // Ensure user is authenticated (strict mode - no sb-session fallback for mutations)
    const { getUserFromAuthClient } = await import('@/lib/server-auth');
    const user = await getUserFromAuthClient(supabase, (n: string) => request.cookies.get(n)?.value, true);
    if (!user) return NextResponse.json({ ok: false, error: 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại' }, { status: 401 });

    // Verify the authenticated user via server cookie and ensure profile exists.
    // Do NOT use the anon key to re-authenticate here; presence of a valid
    // session cookie and an existing profile row is required to allow password change.
    const { data: profileRow, error: profileErr } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
    if (profileErr) {
      serverDebug.error('change-password fetch profile error', profileErr);
      return NextResponse.json({ ok: false, error: 'Không thể xác thực user' }, { status: 500 });
    }
    if (!profileRow || !profileRow.id) {
      return NextResponse.json({ ok: false, error: 'Không tìm thấy user' }, { status: 401 });
    }

    // Update the user's password using their current session (server client)
    try {
      const resp = await supabase.auth.updateUser({ password: newPassword });
      if (resp.error) {
        serverDebug.error('change-password supabase.updateUser error', resp.error);
        return NextResponse.json({ ok: false, error: resp.error.message || String(resp.error) }, { status: 400 });
      }
    } catch (e) {
      serverDebug.error('change-password exception', e);
      return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    serverDebug.error('POST /api/profile/change-password exception', String(err));
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
