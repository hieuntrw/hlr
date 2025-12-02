"use client";

import React, { useEffect, useState } from "react";
import QRCode from 'qrcode';
import { supabase } from "@/lib/supabase-client";
import {
  fetchUserTransactionsClient,
  fetchPublicFundStatsClient,
  uploadReceiptForTransactionClient,
} from '@/lib/services/financeService';

// Mobile-first personal finance page for members
export default function FinancePage() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [pendingTotal, setPendingTotal] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [showPayModal, setShowPayModal] = useState<boolean>(false);
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState<boolean>(false);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [paymentQrUrl, setPaymentQrUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'personal'|'report'>('personal');
  const [publicFund, setPublicFund] = useState<{ balance: number, recentExpenses: any[] }>({ balance: 0, recentExpenses: [] });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      const u = userData?.user || null;
      setUser(u);
      if (u) {
        // Fetch profile for full_name
        const { data: profileData } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', u.id)
          .single();
        if (profileData) {
          setProfile(profileData);
        }
        
        const trs = await fetchUserTransactionsClient(supabase, u.id);
        setTransactions(trs);
        const pending = trs
          .filter((t: any) => (t.payment_status === 'pending' || t.payment_status === 'Chưa nộp' || t.payment_status === 'pending' || t.payment_status === 'submitted'))
          .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
        setPendingTotal(pending);
      }
      const stats = await fetchPublicFundStatsClient(supabase);
      // generate QR for payment using default account string
      try {
        const accountString = `HLR|Vietcombank|0123456789|HLR Running Club`;
        const qr = await QRCode.toDataURL(accountString);
        setPaymentQrUrl(qr);
      } catch (e) {
        console.warn('Failed to generate QR', e);
      }
      setPublicFund(stats);
      setLoading(false);
    })();
  }, []);

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
    const res = await uploadReceiptForTransactionClient(supabase, selectedTransactionId, receiptFile, user.id);
    setUploadingReceipt(false);
    if (res?.ok) {
      // refresh
      const trs = await fetchUserTransactionsClient(supabase, user.id);
      setTransactions(trs);
      const pending = trs
        .filter((t: any) => (t.payment_status === 'pending' || t.payment_status === 'Chưa nộp' || t.payment_status === 'pending' || t.payment_status === 'submitted'))
        .reduce((s: number, t: any) => s + Number(t.amount || 0), 0);
      setPendingTotal(pending);
      setShowUploadModal(false);
      alert('Biên lai đã được gửi. Đang chờ thủ quỹ xác nhận.');
    } else {
      alert('Có lỗi khi tải biên lai. Vui lòng thử lại.');
      console.error(res?.error);
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
      <div className="p-4">
        <div className="animate-pulse h-6 bg-slate-200 rounded w-3/4 mb-4" />
        <div className="animate-pulse h-40 bg-slate-200 rounded" />
      </div>
    );
  }

  return (
    <div>
      <div className="p-4 max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Tài chính cá nhân</h1>

      {/* Personal Summary Card */}
      <section className="mb-6">
        <div className="bg-white rounded-lg shadow-sm p-4">
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
          <div className="mt-3 text-xs text-gray-500">Số dư hiển thị tính theo các khoản có trạng thái "Chưa nộp".</div>
        </div>
      </section>

      {/* Tabs */}
      <div className="mb-4">
        <div className="flex gap-2">
          <button
            className={`px-3 py-2 rounded-md text-sm ${activeTab === 'personal' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 shadow-sm'}`}
            onClick={() => setActiveTab('personal')}
          >
            Lịch sử giao dịch
          </button>
          <button
            className={`px-3 py-2 rounded-md text-sm ${activeTab === 'report' ? 'bg-slate-800 text-white' : 'bg-white text-slate-700 shadow-sm'}`}
            onClick={() => setActiveTab('report')}
          >
            Báo cáo Quỹ CLB
          </button>
        </div>
      </div>

      {activeTab === 'personal' && (
        <section>
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="min-w-full divide-y">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Ngày</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Loại</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Nội dung</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Số tiền</th>
                    <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y">
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-gray-500">Không có giao dịch</td>
                    </tr>
                  )}
                  {transactions.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50">
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
          <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-500">Tổng Quỹ hiện tại</div>
                <div className="mt-1 text-xl font-semibold">{formatCurrency(publicFund.balance)}</div>
              </div>
              <div className="text-sm text-gray-500">Minh bạch & cập nhật</div>
            </div>
            <div className="mt-2 text-xs text-gray-500">Số dư tính bằng tổng thu - tổng chi ghi trong hệ thống.</div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-4">
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
                    <div className="font-medium">{formatCurrency(r.amount)}</div>
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
          <div className="relative w-full sm:w-96 bg-white rounded-t-lg sm:rounded-lg shadow-lg p-4">
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
                <div className="mt-2 font-medium bg-white p-2 rounded">
                  HLR {profile?.full_name || user?.email || 'Tên'} [Nội dung]
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
          <div className="relative w-full sm:w-96 bg-white rounded-t-lg sm:rounded-lg shadow-lg p-4">
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
                  <img src={receiptPreviewUrl} alt="preview" className="max-h-40 rounded" />
                </div>
              )}

              <div className="flex gap-2">
                <button disabled={!receiptFile || uploadingReceipt} className="flex-1 bg-blue-600 text-white px-3 py-2 rounded" onClick={handleUploadReceipt}>
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
