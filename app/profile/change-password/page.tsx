"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthContext';

export default function ChangePasswordPage() {
  const router = useRouter();
  const { refreshAuth, profile, user } = useAuth();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function validateStrength(p: string) {
    if (p.length < 7) return false;
    if (!/[a-z]/.test(p)) return false;
    if (!/[A-Z]/.test(p)) return false;
    if (!/\d/.test(p)) return false;
    return true;
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!oldPassword) return setError('Vui lòng nhập mật khẩu hiện tại');
    if (!newPassword) return setError('Vui lòng nhập mật khẩu mới');
    if (newPassword !== confirmPassword) return setError('Mật khẩu xác nhận không khớp');
    if (!validateStrength(newPassword)) return setError('Mật khẩu phải >=7 ký tự, chứa chữ hoa, chữ thường và số');

    setLoading(true);
    try {
      const res = await fetch('/api/profile/change-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        setError(json?.error || 'Không thể đổi mật khẩu');
        return;
      }
      setSuccess(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      if (refreshAuth) {
        try {
          refreshAuth();
        } catch {}
      }
      setTimeout(() => router.push('/profile'), 900);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-secondary)] p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-6">
        <h1 className="text-xl font-semibold mb-2">Đổi mật khẩu</h1>
        <p className="text-sm text-gray-600 mb-4">Thành viên: {profile?.full_name ?? user?.email ?? '—'}</p>
        <form onSubmit={handleSubmit}>
          <div className="mb-3">
            <label className="block mb-1 text-sm">Mật khẩu hiện tại</label>
            <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} className="w-full border px-3 py-2 rounded" />
          </div>
          <div className="mb-3">
            <label className="block mb-1 text-sm">Mật khẩu mới</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full border px-3 py-2 rounded" />
          </div>
          <div className="mb-3">
            <label className="block mb-1 text-sm">Xác nhận mật khẩu mới</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="w-full border px-3 py-2 rounded" />
          </div>
          {error && <div className="text-red-600 mb-3">{error}</div>}
          {success && <div className="text-green-700 mb-3">Đổi mật khẩu thành công — chuyển hướng...</div>}
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-green-600 text-white rounded" disabled={loading || success}>
              {loading ? 'Đang gửi...' : 'Đổi mật khẩu'}
            </button>
            <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
