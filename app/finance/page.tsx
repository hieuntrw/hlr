"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
// QRCode generation removed (unused)
import { useAuth } from "@/lib/auth/AuthContext";

interface Transaction {
  id: string;
  created_at: string;
  type: string;
  description?: string;
  amount?: number;
  payment_status?: string;
  status?: string;
  receipt_url?: string | null;
}

interface Expense {
  id: string;
  created_at: string;
  description?: string;
  amount?: number;
  type?: string;
}

// Mobile-first personal finance page for members
export default function FinancePage() {
  const { user, isLoading: authLoading, sessionChecked } = useAuth();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pendingTotal, setPendingTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState<boolean>(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  // payment QR removed — not used in UI
  const [activeTab, setActiveTab] = useState<'personal'|'report'>('personal');
  const [publicFund, setPublicFund] = useState<{ balance: number, recentExpenses: Expense[] }>({ balance: 0, recentExpenses: [] });

  useEffect(() => {
    (async () => {
      // Wait for auth to finish loading and session check to complete
      if (authLoading || !sessionChecked) return;
      
      setLoading(true);
      // user from AuthContext

      if (user) {
        // Fetch profile via server endpoint
        try {
          const pRes = await fetch(`/api/profiles/${user.id}`, { credentials: 'same-origin' });
          if (pRes.ok) {
            const pj = await pRes.json().catch(() => null);
            setProfile(pj?.profile ?? null);
          }
        } catch (e) {
          console.warn('Failed to fetch profile via server endpoint', e);
        }

        // Fetch user transactions via server endpoint
        try {
          const trsRes = await fetch('/api/profile/transactions', { credentials: 'same-origin' });
          if (trsRes.ok) {
            const tj = await trsRes.json().catch(() => null);
            const trsRaw = (tj?.data || []) as unknown[];
            const trs = trsRaw.map((r: unknown) => {
              const rec = r as Record<string, unknown>;
              return {
                id: String(rec.id ?? ''),
                created_at: String(rec.created_at ?? ''),
                type: String(rec.type ?? ''),
                description: String(rec.description ?? ''),
                amount: Number(rec.amount ?? 0),
                payment_status: String(rec.payment_status ?? rec.status ?? ''),
                receipt_url: (rec.receipt_url as string) ?? null,
              } as Transaction;
            });
            setTransactions(trs);
            const pending = trs
              .filter((t: unknown) => {
                const row = t as Record<string, unknown>;
                const status = String(row.payment_status ?? row.status ?? '');
                return (status === 'pending' || status === 'Chưa nộp' || status === 'submitted');
              })
              .reduce((s: number, t: unknown) => s + Number((t as Record<string, unknown>).amount ?? 0), 0);
            setPendingTotal(pending);
          }
        } catch (e) {
          console.warn('Failed to fetch transactions via server endpoint', e);
        }
      }

      // Public fund stats via server endpoint
      const statsRes = await fetch('/api/public-fund-stats', { credentials: 'same-origin' }).catch(() => null);
      const stats = statsRes && statsRes.ok ? await statsRes.json().catch(() => null) : null;
      // QR generation intentionally removed (unused)
      setPublicFund(stats);
      setLoading(false);
    })();
  }, [user, authLoading, sessionChecked]);

  // Note: data access uses client-friendly functions from lib/services/financeService

  function formatCurrency(v: number) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);
  }

  async function handleOpenUploadModal(transactionId: string) {
    setSelectedTransactionId(transactionId);
    setReceiptFile(null);
    setReceiptPreviewUrl(null);
    setShowUploadModal(true);
  }

  async function handleUploadReceipt() {
    if (!selectedTransactionId || !receiptFile || !user) return;
    setUploadingReceipt(true);
    try {
      const form = new FormData();
      form.append('file', receiptFile as File);
      const up = await fetch(`/api/profile/transactions/${selectedTransactionId}/upload`, { method: 'POST', body: form, credentials: 'same-origin' });
      setUploadingReceipt(false);
      if (!up.ok) {
        const j = await up.json().catch(() => null);
        alert(j?.error || 'Có lỗi khi tải biên lai. Vui lòng thử lại.');
        return;
      }

      // refresh transactions
      try {
          const trsRes2 = await fetch('/api/profile/transactions', { credentials: 'same-origin' });
        if (trsRes2.ok) {
          const tj2 = await trsRes2.json().catch(() => null);
          const trs2Raw = (tj2?.data || []) as unknown[];
          const trs2 = trs2Raw.map((r: unknown) => {
            const rec = r as Record<string, unknown>;
            return {
              id: String(rec.id ?? ''),
              created_at: String(rec.created_at ?? ''),
              type: String(rec.type ?? ''),
              description: String(rec.description ?? ''),
              amount: Number(rec.amount ?? 0),
              payment_status: String(rec.payment_status ?? rec.status ?? ''),
              receipt_url: (rec.receipt_url as string) ?? null,
            } as Transaction;
          });
          setTransactions(trs2);
          const pending2 = trs2
            .filter((t: unknown) => {
              const row = t as Record<string, unknown>;
              const status = String(row.payment_status ?? row.status ?? '');
              return (status === 'pending' || status === 'Chưa nộp' || status === 'submitted');
            })
            .reduce((s: number, t: unknown) => s + Number((t as Record<string, unknown>).amount ?? 0), 0);
          setPendingTotal(pending2);
        }
      } catch (e) {
        console.warn('Failed to refresh transactions after upload', e);
      }

      setShowUploadModal(false);
      alert('Biên lai đã được gửi. Đang chờ thủ quỹ xác nhận.');
    } catch (err) {
      setUploadingReceipt(false);
      console.error(err);
      alert('Có lỗi khi tải biên lai. Vui lòng thử lại.');
    }
  }

  function handleFileChange(file?: File | null) {
    setReceiptFile(file ?? null);
    setReceiptPreviewUrl(null);
    if (!file) return;
    const maxBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxBytes) {
      alert('File quá lớn. Vui lòng chọn file nhỏ hơn 5MB.');
      setReceiptFile(null);
      return;
    }
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => setReceiptPreviewUrl(String(reader.result));
      reader.readAsDataURL(file);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-secondary)] p-4">
        <div className="animate-pulse rounded w-3/4 mb-4" style={{ height: "24px", background: "var(--color-bg-tertiary)" }} />
        <div className="animate-pulse rounded" style={{ height: "160px", background: "var(--color-bg-tertiary)" }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-secondary)]">
      <div className="p-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Tài chính cá nhân</h1>

      {/* Personal Summary Card */}
      <section className="mb-6">
        <div className="rounded-lg shadow-sm p-4" style={{ background: "var(--color-bg-secondary)" }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-500">Số tiền cần thanh toán</div>
              <div className="mt-1 text-lg font-medium">
                {pendingTotal > 0 ? (
                  <span className="text-red-600">{formatCurrency(pendingTotal)}</span>
                ) : (
                  <span className="text-green-600">Bạn đã hoàn thành nghĩa vụ tài chính</span>
                )}
              </div>
            </div>
            {pendingTotal > 0 && (
              <div>
                <button
                  className="bg-red-600 text-white px-3 py-2 rounded-md text-sm"
                  onClick={() => setShowPayModal(true)}
                >
                  Thanh toán ngay
                </button>
              </div>
            )}
          </div>
          <div className="mt-3 text-xs text-gray-500">Số dư hiển thị tính theo các khoản có trạng thái &quot;Chưa nộp&quot;.</div>
        </div>
      </section>

      {/* Tabs */}
      <div className="mb-4">
        <div className="flex gap-2">
          <button
            className="px-3 py-2 rounded-md text-sm"
            style={
              activeTab === 'personal'
                ? { background: "var(--color-primary)", color: "var(--color-text-inverse)" }
                : { background: "var(--color-bg-secondary)", color: "var(--color-text-secondary)", boxShadow: "var(--shadow-sm)" }
            }
            onClick={() => setActiveTab('personal')}
          >
            Lịch sử giao dịch
          </button>
          <button
            className="px-3 py-2 rounded-md text-sm"
            style={activeTab === 'report' ? { background: "var(--color-primary)", color: "var(--color-text-inverse)" } : { background: "var(--color-bg-secondary)", color: "var(--color-text-secondary)", boxShadow: "var(--shadow-sm)" }}
            onClick={() => setActiveTab('report')}
          >
            Báo cáo Quỹ CLB
          </button>
        </div>
      </div>

      {activeTab === 'personal' && (
        <section>
          <div className="rounded-lg shadow-sm overflow-hidden" style={{ background: "var(--color-bg-secondary)", boxShadow: "var(--shadow-sm)" }}>
            <div className="w-full overflow-x-auto">
              <table className="min-w-full divide-y">
                <thead style={{ background: "var(--color-bg-tertiary)" }}>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Ngày</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Loại</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nội dung</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Số tiền</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ background: "var(--color-bg-secondary)" }}>
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Không có giao dịch</td>
                    </tr>
                  )}
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:opacity-95" style={{ background: "var(--color-bg-secondary)" }}>
                      <td className="px-4 py-3 text-sm text-gray-600">{new Date(t.created_at).toLocaleString('vi-VN')}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 capitalize">{t.type}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.description}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-800">{formatCurrency(Number(t.amount || 0))}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        {t.payment_status === 'paid' || t.payment_status === 'Đã nộp' ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">Đã nộp</span>
                            {t.receipt_url && (
                              <a className="text-xs text-slate-600 underline" href={t.receipt_url} target="_blank" rel="noreferrer">Xem biên lai</a>
                            )}
                          </div>
                        ) : t.payment_status === 'submitted' ? (
                          <div className="flex flex-col items-center gap-1">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">Đã gửi biên lai</span>
                            {t.receipt_url && (
                              <a className="text-xs text-slate-600 underline" href={t.receipt_url} target="_blank" rel="noreferrer">Xem biên lai</a>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">Chưa nộp</span>
                            <button className="text-xs text-slate-700 underline" onClick={() => handleOpenUploadModal(t.id)}>Tôi đã chuyển khoản</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {activeTab === 'report' && (
        <section>
          <div className="rounded-lg shadow-sm p-4 mb-4" style={{ background: "var(--color-bg-secondary)" }}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Tổng Quỹ hiện tại</div>
                <div className="mt-1 text-xl font-semibold">{formatCurrency(publicFund.balance)}</div>
              </div>
              <div className="text-sm text-gray-500">Minh bạch & cập nhật</div>
            </div>
            <div className="mt-2 text-xs text-gray-500">Số dư tính bằng tổng thu - tổng chi ghi trong hệ thống.</div>
          </div>

          <div className="rounded-lg shadow-sm p-4" style={{ background: "var(--color-bg-secondary)" }}>
            <h3 className="text-sm font-medium mb-3">10 khoản Chi gần nhất</h3>
            {publicFund.recentExpenses.length === 0 && (
              <div className="text-sm text-gray-500">Không có khoản chi nào.</div>
            )}
            <ul className="space-y-3">
              {publicFund.recentExpenses.map((r) => (
                <li key={r.id} className="flex justify-between items-start">
                  <div>
                    <div className="text-sm font-medium">{r.description || r.type}</div>
                    <div className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('vi-VN')}</div>
                  </div>
                  <div className="text-sm text-right">
                    <div className="font-medium">{formatCurrency(Number(r.amount ?? 0))}</div>
                    <div className="text-xs text-gray-500">{r.type}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Payment Modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowPayModal(false)} />
          <div className="relative w-full sm:w-96 rounded-t-lg sm:rounded-lg shadow-lg p-4" style={{ background: "var(--color-bg-secondary)" }}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Hướng dẫn chuyển khoản</h2>
                <div className="text-xs text-gray-500">Vui lòng chuyển đúng cú pháp để thủ quỹ dễ đối soát.</div>
              </div>
              <button className="text-slate-500" onClick={() => setShowPayModal(false)}>Đóng</button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <div className="flex items-center gap-4">
                {/* QR placeholder */}
                <div className="w-28 h-28 bg-gray-100 flex items-center justify-center rounded">
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="3" width="7" height="7" stroke="#9CA3AF" strokeWidth="1.5" />
                    <rect x="14" y="3" width="7" height="7" stroke="#9CA3AF" strokeWidth="1.5" />
                    <rect x="3" y="14" width="7" height="7" stroke="#9CA3AF" strokeWidth="1.5" />
                    <rect x="11" y="11" width="2" height="2" fill="#9CA3AF" />
                    <rect x="14" y="14" width="2" height="2" fill="#9CA3AF" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium">Ngân hàng: Vietcombank (ví dụ)</div>
                  <div className="text-sm text-gray-600">Chủ tài khoản: HLR Running Club</div>
                  <div className="text-sm text-gray-600">Số tài khoản: 0123 456 789</div>
                </div>
              </div>

              <div className="bg-gray-50 rounded p-3 text-sm">
                <div className="text-xs text-gray-500">Cú pháp chuyển khoản (ghi rõ để đối soát):</div>
                <div className="mt-2 font-medium p-2 rounded" style={{ background: "var(--color-bg-tertiary)" }}>
                  {`HLR ${String(profile?.full_name ?? user?.email ?? 'Tên')} [Nội dung]`}
                </div>
                <div className="mt-2 text-xs text-gray-500">Ví dụ: HLR Nguyễn Văn A Quỹ tháng 11/2025</div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 bg-green-600 text-white px-3 py-2 rounded" onClick={() => {
                  // For convenience copy text to clipboard (caveat: clipboard only available in browser)
                  const txt = `HLR ${profile?.full_name || user?.email || ''}`;
                  navigator?.clipboard?.writeText(txt).then(() => alert('Đã sao chép cú pháp chuyển khoản'));
                }}>Sao chép cú pháp</button>
                <button className="flex-1 bg-slate-100 text-slate-700 px-3 py-2 rounded" onClick={() => setShowPayModal(false)}>Đóng</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Receipt Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowUploadModal(false)} />
          <div className="relative w-full sm:w-96 rounded-t-lg sm:rounded-lg shadow-lg p-4" style={{ background: "var(--color-bg-secondary)" }}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold">Tải biên lai chuyển khoản</h2>
                <div className="text-xs text-gray-500">Chọn ảnh hoặc file PDF của biên lai. Thủ quỹ sẽ kiểm tra và cập nhật trạng thái.</div>
              </div>
              <button className="text-slate-500" onClick={() => setShowUploadModal(false)}>Đóng</button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4">
              <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)} />
              {receiptPreviewUrl && (
                <div className="mt-2">
                  <Image src={receiptPreviewUrl} alt="preview" width={600} height={240} className="max-h-40 rounded object-contain" />
                </div>
              )}

              <div className="flex gap-2">
                <button disabled={!receiptFile || uploadingReceipt} className="flex-1 px-3 py-2 rounded text-white" style={{ background: "var(--color-primary)" }} onClick={handleUploadReceipt}>
                  {uploadingReceipt ? 'Đang tải...' : 'Gửi biên lai'}
                </button>
                <button className="flex-1 bg-slate-100 text-slate-700 px-3 py-2 rounded" onClick={() => setShowUploadModal(false)}>Hủy</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
