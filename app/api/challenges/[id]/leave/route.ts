import { NextResponse, NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@supabase/ssr';
import serverDebug from '@/lib/server-debug'

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    // Create server supabase client to read session from cookies
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
          set() {
            /* no-op on server route */
          },
          remove() {
            /* no-op on server route */
          },
        },
      }
    );

    // Reconstruct session/user using shared helper (handles sb-session fallback)
    const { getUserFromAuthClient } = await import('@/lib/server-auth');
    const user = await getUserFromAuthClient(supabaseAuth, (name: string) => request.cookies.get(name)?.value);
    if (!user) return NextResponse.json({ error: 'Không xác thực' }, { status: 401 });

    const user_id = user.id;

    const { error } = await supabaseAuth
      .from('challenge_participants')
      .delete()
      .eq('challenge_id', id)
      .eq('user_id', user_id);

    if (error) {
      serverDebug.error('POST /api/challenges/[id]/leave error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    try {
      revalidatePath(`/challenges/${id}`);
      revalidatePath('/challenges');
      revalidatePath('/dashboard');
    } catch (e) {
      serverDebug.warn('[leave.route] revalidatePath failed', String(e));
    }

    return NextResponse.json({ message: 'Left challenge' });
  } catch (err: unknown) {
    serverDebug.error('POST /api/challenges/[id]/leave exception', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
