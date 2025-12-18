import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';
import ensureAdmin from '@/lib/server-auth';


// use shared `ensureAdmin` helper

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabaseAuth = createServerClient(
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

    await ensureAdmin(supabaseAuth);

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      serverDebug.error('SUPABASE_SERVICE_ROLE_KEY not configured');
      return NextResponse.json({ error: 'Server not configured' }, { status: 500 });
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const id = params.id;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const { data, error } = await service.from('profiles').select('id,full_name,gender,email,phone_number,join_date').eq('id', id).maybeSingle();
    if (error) {
      serverDebug.error('Failed to fetch profile', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Since `profiles.role` column may be removed, fetch role from auth.users app_metadata
    let roleValue: string | null = null;
    try {
      const { data: authUser } = await service.from('auth.users').select('id, app_metadata').eq('id', id).maybeSingle();
      if (authUser && authUser.app_metadata && typeof authUser.app_metadata === 'object') {
        roleValue = (authUser.app_metadata as Record<string, unknown>)['role'] as string | null;
      }
    } catch {
      // ignore - role will be null
    }

    return NextResponse.json({ data: { ...data, role: roleValue } });
  } catch (err: unknown) {
    serverDebug.error('Exception in admin profile get', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const body = await request.json().catch(() => null);
    if (!body) return NextResponse.json({ error: 'Missing body' }, { status: 400 });

    const supabaseAuth = createServerClient(
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

    await ensureAdmin(supabaseAuth);

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

    const client = service || supabaseAuth;

    // Only allow specific fields to be updated via this endpoint
    const allowed: Record<string, unknown> = {};
    const fields = ['full_name','phone_number','dob','gender','device_name','join_date','pb_hm_seconds','pb_fm_seconds','pb_hm_approved','pb_fm_approved','is_active','leave_date'];
    for (const k of fields) {
      if (Object.prototype.hasOwnProperty.call(body, k)) allowed[k] = (body as Record<string, unknown>)[k];
    }

    // Handle role update via Auth admin API if requested
    if (Object.prototype.hasOwnProperty.call(body, 'role')) {
      const newRole = (body as Record<string, unknown>)['role'] as string | undefined;
      if (newRole) {
        if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
          serverDebug.error('Cannot update role without service role key');
          return NextResponse.json({ error: 'Server not configured to update roles' }, { status: 500 });
        }
        try {
          const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
          const { error: upErr } = await adminClient.auth.admin.updateUserById(id, {
            app_metadata: { role: newRole },
            user_metadata: {},
          });
          if (upErr) {
            serverDebug.error('Failed to update auth user role', upErr);
            return NextResponse.json({ error: upErr.message }, { status: 500 });
          }
        } catch (e) {
          serverDebug.error('Exception updating auth role', e);
          return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
        }
      }
    }

    const { data: updatedData, error } = await client.from('profiles').update(allowed).eq('id', id).select().maybeSingle();
    if (error) {
      serverDebug.error('PATCH /api/admin/profiles/[id] error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ updated: updatedData });
  } catch (err: unknown) {
    serverDebug.error('PATCH /api/admin/profiles/[id] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    const supabaseAuth = createServerClient(
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

    await ensureAdmin(supabaseAuth);

    const service = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
      : null;

    const client = service || supabaseAuth;

    const now = new Date().toISOString().slice(0,10);
    const { data, error } = await client.from('profiles').update({ is_active: false, leave_date: now }).eq('id', id).select().maybeSingle();
    if (error) {
      serverDebug.error('DELETE /api/admin/profiles/[id] error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ deleted: data });
  } catch (err: unknown) {
    serverDebug.error('DELETE /api/admin/profiles/[id] exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
