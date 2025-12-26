import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';
import { requireAdminFromRequest } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Require admin/mod authentication for file uploads
    await requireAdminFromRequest((name: string) => request.cookies.get(name)?.value);
    
    const form = await request.formData();
    const fileVal = form.get('file');
    const bucket = String(form.get('bucket') || 'public');

    if (!fileVal || typeof (fileVal as unknown as { arrayBuffer?: unknown }).arrayBuffer !== 'function') return NextResponse.json({ error: 'Missing file' }, { status: 400 });

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Service role key not configured' }, { status: 500 });
    }

    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    const file = fileVal as { arrayBuffer: () => Promise<ArrayBuffer>; name?: string; type?: string };
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = file.name || `upload-${Date.now()}`;
    const ext = filename.includes('.') ? filename.split('.').pop() : '';
    const path = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext ? '.' + ext : ''}`;

    const { data, error } = await service.storage.from(bucket).upload(path, buffer, { contentType: file.type || 'application/octet-stream', cacheControl: '3600', upsert: false });
    if (error) {
      serverDebug.error('Storage upload error', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: pub } = service.storage.from(bucket).getPublicUrl(data.path || path);
    const publicUrl = pub?.publicUrl || null;

    return NextResponse.json({ publicUrl, path: data.path || path });
  } catch (err: unknown) {
    serverDebug.error('POST /api/admin/storage/upload exception', err);
    const status = (err as Record<string, unknown>)?.status || 500;
    return NextResponse.json({ error: (err as Record<string, unknown>)?.message || String(err) }, { status: typeof status === 'number' ? status : 500 });
  }
}
