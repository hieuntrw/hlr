# HỆ THỐNG TÀI CHÍNH & QUẢN TRỊ NGÂN SÁCH - HẢI LĂNG RUNNERS

**Phiên bản:** 2.0 (Final Optimized)
**Ngày cập nhật:** 21/12/2025
**Mô hình:** Kế toán đơn (Single Entry) - Quản lý dòng tiền Thu/Chi theo năm.

---

## I. CƠ SỞ DỮ LIỆU (DATABASE SCHEMA)

### 1. Nguyên tắc thiết kế
* **Tối ưu hóa:** Sử dụng bảng đơn `transactions` kết hợp với `financial_categories`.
* **Linh hoạt:** Sử dụng cột `metadata` (JSONB) để lưu trữ các thông tin tham chiếu động (ID giải chạy, ID phần thưởng...) thay vì tạo nhiều cột cứng.
* **Báo cáo:** Sử dụng SQL Views để tổng hợp dữ liệu thời gian thực cho Frontend.

### 2. Danh mục Tài chính (Financial Categories)
Bảng định nghĩa các mã nguồn tiền để phân loại báo cáo.

| Tên hiển thị | Mã Code (Constant) | Loại (Flow) | Mô tả / Ghi chú |
| :--- | :--- | :--- | :--- |
| **KHOẢN THU** | | | |
| Thu Quỹ Tháng | `MONTHLY_FUND` | `in` | Phí thường niên (50k/tháng) |
| Phạt Thử Thách | `CHALLENGE_FINE` | `in` | Phạt không hoàn thành (100k) |
| Ủng hộ/Tài trợ | `DONATION` | `in` | Mạnh thường quân đóng góp |
| **KHOẢN CHI** | | | |
| Chi Thưởng Mốc | `REWARD_CASH_MILESTONE` | `out` | Tiền mặt (Sub 3, Sub 3:30...) |
| Chi Thưởng Podium | `REWARD_CASH_PODIUM` | `out` | Tiền mặt (Top 1-2-3) |
| Chi Mua Quà/Hiện vật| `EXPENSE_GIFT_PURCHASE` | `out` | Mua Cúp, Cờ, Quà Lucky Draw... |
| Chi Hoạt động | `EXPENSE_OPERATION` | `out` | Nước nôi, Dưa hấu Longrun... |

### 3. File Migration SQL (Full Script)
*Chạy script này trong Supabase SQL Editor để khởi tạo/cập nhật DB.*

```sql
-- =================================================================
-- 1. TẠO BẢNG DANH MỤC (FINANCIAL CATEGORIES)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.financial_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NULL UNIQUE, 
  flow_type text NOT NULL CHECK (flow_type IN ('in', 'out')),
  is_recurring boolean DEFAULT false,
  description text NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT financial_categories_pkey PRIMARY KEY (id)
);

-- Bật RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Categories" ON public.financial_categories FOR SELECT USING (true);

-- Seed Data (Dữ liệu danh mục chuẩn)
INSERT INTO public.financial_categories (name, code, flow_type, is_recurring) VALUES 
('Thu Quỹ Tháng', 'MONTHLY_FUND', 'in', true),
('Phạt Thử Thách', 'CHALLENGE_FINE', 'in', true),
('Ủng hộ/Tài trợ', 'DONATION', 'in', false),
('Chi Thưởng Mốc (Tiền mặt)', 'REWARD_CASH_MILESTONE', 'out', false),
('Chi Thưởng Podium (Tiền mặt)', 'REWARD_CASH_PODIUM', 'out', false),
('Chi Mua Quà/Hiện vật', 'EXPENSE_GIFT_PURCHASE', 'out', false),
('Chi Hoạt động (Longrun)', 'EXPENSE_OPERATION', 'out', false)
ON CONFLICT (code) DO NOTHING;

-- =================================================================
-- 2. TỐI ƯU HÓA BẢNG TRANSACTIONS
-- =================================================================
-- 2.1. Thêm các cột mới cần thiết
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.financial_categories(id),
ADD COLUMN IF NOT EXISTS fiscal_year int DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
ADD COLUMN IF NOT EXISTS period_month int,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS processed_by uuid REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS processed_at timestamp with time zone;

-- 2.2. Migrate dữ liệu cũ (Map Type cũ -> Category mới)
UPDATE public.transactions SET category_id = (SELECT id FROM financial_categories WHERE code = 'MONTHLY_FUND') WHERE type = 'fund_collection' AND category_id IS NULL;
UPDATE public.transactions SET category_id = (SELECT id FROM financial_categories WHERE code = 'CHALLENGE_FINE') WHERE type = 'fine' AND category_id IS NULL;
UPDATE public.transactions SET category_id = (SELECT id FROM financial_categories WHERE code = 'DONATION') WHERE type = 'donation' AND category_id IS NULL;
UPDATE public.transactions SET category_id = (SELECT id FROM financial_categories WHERE code = 'EXPENSE_OPERATION') WHERE type = 'expense' AND category_id IS NULL;
UPDATE public.transactions SET category_id = (SELECT id FROM financial_categories WHERE code = 'EXPENSE_GIFT_PURCHASE') WHERE type = 'reward_payout' AND category_id IS NULL;

-- 2.3. Migrate dữ liệu quan hệ cũ -> Metadata
UPDATE public.transactions 
SET metadata = jsonb_build_object(
    'source_table', 'legacy_data',
    'related_challenge_id', related_challenge_id, 
    'related_reward_id', related_member_reward_id,
    'note', 'Migrated from old columns'
)
WHERE related_challenge_id IS NOT NULL OR related_member_reward_id IS NOT NULL;

-- 2.4. Migrate Audit Log
UPDATE public.transactions SET processed_by = paid_by, processed_at = paid_at WHERE payment_status = 'paid';
UPDATE public.transactions SET processed_by = rejected_by, processed_at = rejected_at WHERE payment_status IN ('cancelled', 'rejected');

-- 2.5. Xóa cột cũ & Khóa cấu trúc
ALTER TABLE public.transactions 
DROP COLUMN IF EXISTS type,
DROP COLUMN IF EXISTS related_challenge_id,
DROP COLUMN IF EXISTS related_member_reward_id,
DROP COLUMN IF EXISTS paid_by,
DROP COLUMN IF EXISTS paid_at,
DROP COLUMN IF EXISTS rejected_by,
DROP COLUMN IF EXISTS rejected_at,
DROP COLUMN IF EXISTS transaction_date; -- Dùng created_at thay thế

ALTER TABLE public.transactions ALTER COLUMN category_id SET NOT NULL;

-- =================================================================
-- 3. TẠO CÁC VIEW BÁO CÁO (REPORTING VIEWS)
-- =================================================================

-- 3.1. View Tài chính Cá nhân (Member xem nợ & lịch sử)
CREATE OR REPLACE VIEW public.view_my_finance_status WITH (security_invoker = true) AS 
SELECT 
    t.id as transaction_id,
    t.user_id,
    fc.name as category_name,
    fc.code as category_code,
    fc.flow_type,
    t.amount,
    t.description,
    t.created_at,
    t.payment_status,
    t.fiscal_year,
    t.period_month,
    t.metadata
FROM public.transactions t
JOIN public.financial_categories fc ON t.category_id = fc.id;

-- 3.2. View Quỹ Công khai (Tổng hợp số liệu cho Dashboard)
CREATE OR REPLACE VIEW public.view_public_fund_stats AS
SELECT 
    EXTRACT(YEAR FROM CURRENT_DATE)::int as fiscal_year,
    -- Tổng Thu
    COALESCE(SUM(CASE WHEN fc.flow_type = 'in' AND t.payment_status = 'paid' THEN t.amount ELSE 0 END), 0) as total_income,
    -- Tổng Chi
    COALESCE(SUM(CASE WHEN fc.flow_type = 'out' AND t.payment_status = 'paid' THEN t.amount ELSE 0 END), 0) as total_expense,
    -- Số dư = Thu - Chi
    (
      COALESCE(SUM(CASE WHEN fc.flow_type = 'in' AND t.payment_status = 'paid' THEN t.amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN fc.flow_type = 'out' AND t.payment_status = 'paid' THEN t.amount ELSE 0 END), 0)
    ) as current_balance
FROM public.transactions t
JOIN public.financial_categories fc ON t.category_id = fc.id
WHERE t.fiscal_year = EXTRACT(YEAR FROM CURRENT_DATE);

GRANT SELECT ON public.view_public_fund_stats TO authenticated;

-- 3.3. View Chi tiêu Công khai (Minh bạch hóa 20 khoản chi gần nhất)
CREATE OR REPLACE VIEW public.view_public_recent_expenses AS
SELECT 
    t.processed_at as payment_date,
    fc.name as category_name,
    t.description,
    t.amount,
    t.metadata
FROM public.transactions t
JOIN public.financial_categories fc ON t.category_id = fc.id
WHERE fc.flow_type = 'out' AND t.payment_status = 'paid'
ORDER BY t.processed_at DESC LIMIT 20;

GRANT SELECT ON public.view_public_recent_expenses TO authenticated;