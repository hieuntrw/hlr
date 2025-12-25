// This page is a client component so we can use `useParams` and client-side
// hooks directly. Convert the file to client mode and read `id` from router.
'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';
import { getEffectiveRole, isAdminRole } from '@/lib/auth/role';

interface TransactionDetail {
  id: number | string;
  created_at: string;
  member_info?: { full_name?: string } | null;
  description?: string | null;
  category_name?: string | null;
  category_code?: string | null;
  amount?: number | null;
  payment_status?: string | null;
  flow_type?: 'in' | 'out' | string | null;
}

export default function TransactionDetailPageClient() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : String(params?.id ?? '');
  const { user } = useAuth();
  const router = useRouter();
  const [tx, setTx] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = !!user && isAdminRole(getEffectiveRole(user));

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const resp = await fetch(`/api/finance/transactions?id=${encodeURIComponent(id)}`, { credentials: 'include' });
        let body: unknown = null;
        try {
          body = await resp.json();
        } catch {
          body = null;
        }

        function formatErr(e: unknown) {
          if (e === null || e === undefined) return String(e);
          if (typeof e === 'string') return e;
          try {
            return JSON.stringify(e);
          } catch {
            try {
              return String(e);
            } catch {
              return 'Unknown error';
            }
          }
        }

        const bodyObj = (typeof body === 'object' && body !== null) ? (body as Record<string, unknown>) : null;

        if (!resp.ok || !(bodyObj && (bodyObj.ok as unknown))) {
          console.error('[tx detail] fetch failed', { status: resp.status, body });
          const msg = bodyObj && 'error' in bodyObj ? formatErr(bodyObj.error) : `Không thể tải giao dịch (status ${resp.status})`;
          setError(msg);
          setTx(null);
        } else {
          const data = bodyObj && Object.prototype.hasOwnProperty.call(bodyObj, 'data') ? (bodyObj as Record<string, unknown>)['data'] : null;
          if (mounted) setTx(((data as unknown) as TransactionDetail) ?? null);
        }
      } catch (err) {
        console.error('[tx detail] unexpected error', err);
        const msg = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
        setError(msg || 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    // Wait for auth info to be available
    if (!user) {
      // not signed in (or still loading) — don't attempt fetch yet
      return;
    }

    if (!isAdmin) {
      setError('Quyền truy cập bị từ chối: chỉ admin mới được xem/trình chỉnh sửa.');
      setLoading(false);
      return;
    }

    if (!id || id === 'undefined') {
      setError('Missing transaction id');
      setLoading(false);
    } else {
      load();
    }
    return () => { mounted = false; };
  }, [id, user, isAdmin]);

  const [form, setForm] = useState<Partial<TransactionDetail>>({});
  useEffect(() => {
    if (tx) setForm({ description: tx.description ?? '', amount: tx.amount ?? 0, category_name: tx.category_name ?? tx.category_code ?? '', payment_status: tx.payment_status ?? '', flow_type: tx.flow_type ?? '' });
  }, [tx]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tx) return;
    setSaving(true);
    setError(null);
    try {
      const updates: Partial<TransactionDetail> = {
        description: form.description,
        amount: Number(form.amount ?? 0),
        category_name: form.category_name,
        payment_status: form.payment_status,
        flow_type: form.flow_type,
      };
      const resp = await fetch('/api/finance/transactions', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id: tx.id, updates }),
      });
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok || !body?.ok) {
        const msg = body?.error
          ? (typeof body.error === 'string' ? body.error : JSON.stringify(body.error))
          : `Lưu thất bại (status ${resp.status})`;
        setError(msg);
      } else {
        router.back();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : (typeof err === 'object' ? JSON.stringify(err) : String(err));
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-6">Đang tải...</div>;
  if (error) return <div className="p-6 text-red-600">Lỗi: {error}</div>;
  if (!tx) return <div className="p-6">Giao dịch không tồn tại.</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Chi tiết giao dịch #{tx.id}</h1>
      <div className="mb-4 text-sm text-gray-600">Ngày: {new Date(tx.created_at).toLocaleString('en-GB')}</div>
      <div className="mb-4">
        <div className="mb-2 font-medium">Thành viên</div>
        <div>{tx.member_info?.full_name ?? '-'}</div>
      </div>
      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Mô tả</label>
          <textarea value={String(form.description ?? '')} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1 block w-full border rounded-md p-2" rows={3} />
        </div>
        <div>
          <label className="block text-sm font-medium">Số tiền</label>
          <input type="number" value={String(form.amount ?? 0)} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} className="mt-1 block w-48 border rounded-md p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Danh mục</label>
          <input value={String(form.category_name ?? '')} onChange={(e) => setForm({ ...form, category_name: e.target.value })} className="mt-1 block w-full border rounded-md p-2" />
        </div>
        <div className="flex gap-4">
          <div>
            <label className="block text-sm font-medium">Trạng thái</label>
            <select value={String(form.payment_status ?? '')} onChange={(e) => setForm({ ...form, payment_status: e.target.value })} className="mt-1 block border rounded-md p-2">
              <option value="">-- Chọn --</option>
              <option value="pending">pending</option>
              <option value="paid">paid</option>
              <option value="cancelled">cancelled</option>
                       </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Loại</label>
            <select value={String(form.flow_type ?? '')} onChange={(e) => setForm({ ...form, flow_type: e.target.value })} className="mt-1 block border rounded-md p-2">
              <option value="">-- Chọn --</option>
              <option value="in">in</option>
              <option value="out">out</option>
            </select>
          </div>
        </div>

        {isAdmin ? (
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-md">{saving ? 'Đang lưu...' : 'Lưu'}</button>
            <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded-md">Hủy</button>
          </div>
        ) : (
          <div className="text-sm text-gray-500">Bạn không có quyền chỉnh sửa.</div>
        )}
      </form>
    </div>
  );
}
