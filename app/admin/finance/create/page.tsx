'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
// using server APIs via fetch and financeService; no direct supabase client here
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
// transactions are created via server API POST /api/finance/transactions

// 1. Định nghĩa Types nội bộ để tránh dùng 'any'
interface Category {
  id: string;
  name: string;
  code: string;
  flow_type: 'in' | 'out';
}

interface Profile {
  id: string;
  full_name: string;
}

interface FinanceFormData {
  flow_type: 'in' | 'out';
  category_code: string;
  amount: number;
  description: string;
  user_id: string;
  note: string;
  fiscal_year?: number;
  period_month?: number;
}

export default function CreateTransactionPage() {
  // 2. Gán kiểu dữ liệu cho useForm
  const now = new Date();
  const { register, handleSubmit, watch, reset, setValue } = useForm<FinanceFormData>({
    defaultValues: {
      flow_type: 'in',
      fiscal_year: now.getFullYear(),
      period_month: now.getMonth() + 1,
    }
  });

  // 3. Gán kiểu dữ liệu cho State thay vì any[]
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  // use shared supabase singleton

  const flowType = watch('flow_type');

  const normalizedFlowType = (typeof flowType === 'string' ? flowType : String(flowType ?? 'in')).toLowerCase();

  useEffect(() => {
    async function init() {
      const catPromise = fetch('/api/admin/financial-categories?fields=id,name,code,flow_type', { credentials: 'same-origin' });
      const usersPromise = fetch('/api/admin/profiles?fields=id,full_name&is_active=true', { credentials: 'same-origin' });

      const [catRes, usersRes] = await Promise.all([catPromise, usersPromise]);

      try {
        let catsJson: { data?: Category[] } | null = null;
        if (!catRes.ok) {
          const text = await catRes.text();
          console.error('[CreateTransaction] /api/admin/financial-categories failed', catRes.status, text);
        } else {
          catsJson = await catRes.json();
          console.log('[CreateTransaction] raw categories response:', catsJson);
          if (catsJson?.data) {
            setCategories(catsJson.data as Category[]);
            console.log('[CreateTransaction] loaded categories count:', (catsJson?.data ?? []).length);

            // If no category_code selected yet, pick the first matching one for the initial flow_type
            const initialFlow = normalizedFlowType;
            const firstMatch = (catsJson.data as Category[]).find((c: Category) => String(c.flow_type ?? '').toLowerCase() === initialFlow);
            if (firstMatch) {
              setValue('category_code', firstMatch.code);
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse /api/admin/financial-categories response', e);
      }

      try {
        const usersJson = await usersRes.json();
        if (usersJson?.data) setUsers(usersJson.data as Profile[]);
      } catch (e) {
        console.error('Failed to parse /api/admin/profiles response', e);
      }
    }
    init();
  }, [normalizedFlowType, setValue]);

  const filteredCategories = categories.filter(c => String(c.flow_type ?? '').toLowerCase() === normalizedFlowType);
  // Runtime visibility for debugging: helpful when options appear empty
  useEffect(() => {
    console.log('[CreateTransaction] filteredCategories count:', filteredCategories.length, 'flowType=', normalizedFlowType);
  }, [filteredCategories.length, normalizedFlowType]);

  // 4. Định nghĩa kiểu cho data đầu vào (Fix lỗi Implicit any)
  const onSubmit = async (data: FinanceFormData) => {
    setLoading(true);
    try {
      const payload = {
        category_code: data.category_code,
        amount: Number(data.amount),
        description: data.description,
        user_id: data.user_id || null,
        metadata: {
          note: data.note,
          manual_entry: true,
        },
        fiscal_year: data.fiscal_year ? Number(data.fiscal_year) : undefined,
        period_month: data.period_month ? Number(data.period_month) : undefined,
      };

      const res = await fetch('/api/finance/transactions', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        console.error('[CreateTransaction] create failed', res.status, json);
        alert('Lỗi khi tạo giao dịch. Vui lòng thử lại.');
        return;
      }

      alert('Tạo giao dịch thành công!');
      reset();
    } catch (error) {
      console.error(error);
      alert('Lỗi khi tạo giao dịch. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border mb-4 transition"
        style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-primary)', background: 'transparent' }}
        aria-label="Quay lại"
      >
        <ArrowLeft size={18} /> Quay lại Dashboard
      </button>

      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-6 border-b pb-4">Tạo Giao dịch Mới</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          
          <div className="grid grid-cols-2 gap-4">
            <label className={`cursor-pointer border-2 rounded-xl p-4 text-center transition ${flowType === 'in' ? 'border-green-500 bg-green-50' : 'border-gray-100 hover:border-gray-200'}`}>
              <input type="radio" value="in" {...register('flow_type')} className="hidden" />
              <span className={`block font-bold ${flowType === 'in' ? 'text-green-700' : 'text-gray-500'}`}>KHOẢN THU (IN)</span>
              <span className="text-xs text-gray-400">Thu quỹ, phạt, ủng hộ</span>
            </label>
            <label className={`cursor-pointer border-2 rounded-xl p-4 text-center transition ${flowType === 'out' ? 'border-orange-500 bg-orange-50' : 'border-gray-100 hover:border-gray-200'}`}>
              <input type="radio" value="out" {...register('flow_type')} className="hidden" />
              <span className={`block font-bold ${flowType === 'out' ? 'text-orange-700' : 'text-gray-500'}`}>KHOẢN CHI (OUT)</span>
              <span className="text-xs text-gray-400">Mua sắm, hoạt động, thưởng</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Danh mục tài chính</label>
            <select 
              {...register('category_code', { required: true })} 
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              {filteredCategories.map(cat => (
                <option key={cat.id} value={cat.code}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Số tiền (VNĐ)</label>
            <input 
              type="number" 
              {...register('amount', { required: true, min: 1000 })} 
              className="w-full border border-gray-300 rounded-lg p-3 font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="0" 
            />
          </div>

          <div>
             <label className="block text-sm font-medium text-gray-700 mb-2">Mô tả chi tiết</label>
             <textarea 
               {...register('description', { required: true })} 
               rows={3}
               className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
               placeholder="Ví dụ: Mua 3 thùng nước + 5kg dưa hấu..."
             />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Năm áp dụng</label>
              <input
                type="number"
                {...register('fiscal_year', { valueAsNumber: true })}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                min={2000}
                max={2100}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tháng áp dụng</label>
              <select {...register('period_month', { valueAsNumber: true })} className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none">
                <option value="">-- Chọn tháng --</option>
                {Array.from({ length: 12 }).map((_, i) => (
                  <option key={i+1} value={i+1}>{i+1}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Thành viên liên quan <span className="text-gray-400 font-normal">(Để trống nếu là Chi hoạt động chung)</span>
            </label>
            <select 
              {...register('user_id')} 
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="">-- Không chọn --</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.full_name}</option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border">
            <label className="block text-sm font-medium text-gray-700 mb-2">Ghi chú thêm (Metadata)</label>
            <input 
              {...register('note')} 
              className="w-full border border-gray-300 rounded-lg p-2 text-sm"
              placeholder="Ghi chú nội bộ cho admin..." 
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full font-medium py-3 rounded-lg shadow-sm transition flex items-center justify-center gap-2 disabled:opacity-70"
            style={{ background: 'var(--color-primary)', color: 'var(--color-text-inverse)' }}
          >
            {loading ? 'Đang xử lý...' : <><Save size={20} /> Lưu Giao dịch</>}
          </button>

        </form>
      </div>
    </div>
  );
}