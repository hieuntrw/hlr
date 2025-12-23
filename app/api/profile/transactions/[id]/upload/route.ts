import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import serverDebug from '@/lib/server-debug';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const transactionId = params.id;
    const form = await request.formData();
    const rawFile = form.get('file');
    if (!rawFile) return NextResponse.json({ ok: false, error: 'Missing file' }, { status: 400 });
    const fileRaw = rawFile as unknown;

    // Reconstruct session using cookies
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

    const { getUserFromAuthClient } = await import('@/lib/server-auth');
    const user = await getUserFromAuthClient(supabase, (name: string) => request.cookies.get(name)?.value);
    if (!user) return NextResponse.json({ ok: false, error: 'Không xác thực' }, { status: 401 });

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ ok: false, error: 'Service role key not configured' }, { status: 500 });
    }

    const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

    // Obtain ArrayBuffer from uploaded blob-like object
    let arrayBuffer: ArrayBuffer;
    const asRecord = (fileRaw as unknown) as Record<string, unknown>;
    if (asRecord && typeof asRecord.arrayBuffer === 'function') {
      arrayBuffer = await (asRecord.arrayBuffer as unknown as () => Promise<ArrayBuffer>)();
    } else {
      return NextResponse.json({ ok: false, error: 'Invalid file upload' }, { status: 400 });
    }

    const buffer = Buffer.from(arrayBuffer);
    const filename = (typeof asRecord.name === 'string' ? asRecord.name : `receipt-${Date.now()}`);
    const ext = filename.includes('.') ? filename.split('.').pop() : '';
    const path = `receipts/${new Date().getFullYear()}/${String(new Date().getMonth()+1).padStart(2,'0')}/${transactionId}_${Date.now()}${ext?'.'+ext:''}`;

    const { data: uploadData, error: uploadError } = await service.storage.from('receipts').upload(path, buffer, { contentType: typeof asRecord.type === 'string' ? asRecord.type : 'application/octet-stream', cacheControl: '3600', upsert: false });
    if (uploadError) {
      serverDebug.error('Storage upload error', uploadError);
      return NextResponse.json({ ok: false, error: uploadError.message }, { status: 500 });
    }

    const { data: pub } = service.storage.from('receipts').getPublicUrl(uploadData.path || path);
    const publicUrl = pub?.publicUrl || null;

    const { data: tx, error: txErr } = await supabase
      .from('transactions')
      .update({ receipt_url: publicUrl, payment_status: 'submitted', receipt_uploaded_by: user.id, receipt_uploaded_at: new Date().toISOString() })
      .eq('id', transactionId)
      .select()
      .maybeSingle();

    if (txErr) {
      serverDebug.error('Update transaction with receipt error', txErr);
      return NextResponse.json({ ok: false, error: txErr.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, transaction: tx, publicUrl });
  } catch (err: unknown) {
    serverDebug.error('/api/profile/transactions/[id]/upload exception', String(err));
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
