-- =================================================================
-- 1. TẠO BẢNG DANH MỤC TÀI CHÍNH (FINANCIAL CATEGORIES)
-- =================================================================
CREATE TABLE IF NOT EXISTS public.financial_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NULL UNIQUE, -- Định danh (MONTHLY_FUND, CHALLENGE_FINE...)
  flow_type text NOT NULL CHECK (flow_type IN ('in', 'out')), -- in=Thu, out=Chi
  is_recurring boolean DEFAULT false,
  description text NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT financial_categories_pkey PRIMARY KEY (id)
);

-- Bật RLS
ALTER TABLE public.financial_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public Read Categories" ON public.financial_categories FOR SELECT USING (true);

-- Seed Data (Dữ liệu mẫu)
INSERT INTO public.financial_categories (name, code, flow_type, is_recurring) VALUES 
INSERT INTO public.financial_categories (name, code, flow_type, is_recurring) VALUES 
('Thu Quỹ Tháng', 'MONTHLY_FUND', 'in', true),
('Phạt Thử Thách', 'CHALLENGE_FINE', 'in', true),
('Ủng hộ/Tài trợ', 'DONATION', 'in', false),
('Chi Thưởng Mốc (Tiền mặt)', 'REWARD_CASH_MILESTONE', 'out', false),
('Chi Thưởng Podium (Tiền mặt)', 'REWARD_CASH_PODIUM', 'out', false),
('Chi Mua Quà/Hiện vật', 'EXPENSE_GIFT_PURCHASE', 'out', false),
('Chi Hoạt động (Longrun)', 'EXPENSE_OPERATION', 'out', false),
('Số dư đầu kỳ', 'OPENING_BALANCE', 'in', false) --Tiền tồn quỹ từ năm trước chuyển sang
ON CONFLICT (code) DO NOTHING;

-- =================================================================
-- 2. TỐI ƯU HÓA BẢNG TRANSACTIONS
-- =================================================================
-- 2.1. Thêm các cột mới
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
-- Nếu còn dòng nào chưa có category, gán tạm vào EXPENSE_OPERATION hoặc xóa
-- DELETE FROM transactions WHERE category_id IS NULL; 

-- 2.3. Migrate dữ liệu quan hệ -> Metadata
-- ... (Phần thêm cột metadata giữ nguyên) ...

-- Migrate dữ liệu cũ (Giả sử bạn đang có cột related_member_reward_id liên kết với bảng reward cũ)
-- Chúng ta sẽ chuyển ID đó vào metadata để tra cứu ngược lại nguồn gốc
UPDATE public.transactions 
SET metadata = jsonb_build_object(
    'source_table', 'member_milestone_rewards', -- Đánh dấu nguồn
    'reward_id', related_member_reward_id,      -- ID bản ghi gốc
    'note', 'Migrated data'
)
WHERE related_member_reward_id IS NOT NULL;

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
DROP COLUMN IF EXISTS transaction_date; -- Dùng created_at

ALTER TABLE public.transactions ALTER COLUMN category_id SET NOT NULL;




-- 1. BẬT RLS (Nếu chưa bật)
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- 2. XÓA CÁC POLICY CŨ (Để tránh trùng lặp)
DROP POLICY IF EXISTS "Cho phép User xem giao dịch" ON public.transactions;
DROP POLICY IF EXISTS "Cho phép Mod/Admin thêm sửa" ON public.transactions;
DROP POLICY IF EXISTS "Admin full quyền" ON public.transactions;

-- 3. CẤP QUYỀN CƠ BẢN CHO AUTHENTICATED USER
-- (Lưu ý: Đây chỉ là quyền "được phép thử", còn thành công hay không do Policy bên dưới quyết định)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT SELECT ON public.financial_categories TO authenticated;

-- =========================================================
-- 4. THIẾT LẬP LUẬT (POLICIES)
-- =========================================================

-- LUẬT 1: XEM (SELECT) - Áp dụng cho TẤT CẢ thành viên đã đăng nhập
-- Ai cũng được xem để thấy sự minh bạch
CREATE POLICY "Public View Transactions" 
ON public.transactions FOR SELECT 
TO authenticated 
USING (true);

-- LUẬT 2: THÊM & SỬA (INSERT, UPDATE) - Chỉ dành cho 'admin' và 'mod_finance'
-- Hệ thống sẽ kiểm tra trong App Metadata của User
CREATE POLICY "Mod Finance Insert/Update" 
ON public.transactions FOR ALL 
TO authenticated 
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_finance')
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_finance')
);

-- LUẬT 3: SERVICE ROLE (Luôn full quyền để chạy các Job tự động/System)
CREATE POLICY "Service Role Full Access" 
ON public.transactions FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);
-- =================================================================
-- 3. TẠO CÁC VIEW BÁO CÁO (REPORTING VIEWS)
-- =================================================================

-- 3.1. View Tài chính Cá nhân (Dùng cho Member xem nợ/lịch sử)
REATE OR REPLACE VIEW public.view_my_finance_status 
WITH (security_invoker = true) 
AS
SELECT 
    t.id as transaction_id,
    t.user_id,
    fc.name as category_name,
    fc.code as category_code,
    fc.flow_type,
    t.amount,
    t.description,
    t.created_at,      -- Ngày tạo giao dịch
    t.payment_status,  -- Trạng thái (paid/pending/cancelled)
    t.fiscal_year,
    t.period_month,
    t.processed_at,    -- Ngày thực đóng tiền
    t.metadata         -- JSON chứa thông tin mở rộng (Challenge, Reward...)
FROM 
    public.transactions t
JOIN 
    public.financial_categories fc ON t.category_id = fc.id;

-- Bước 2.3: Cấp quyền đọc
GRANT SELECT ON public.view_my_finance_status TO authenticated;

-- 3.2. View Quỹ Công khai (Tổng hợp số liệu)
-- ================================================================
-- TẠO LẠI VIEW: view_public_fund_stats
-- (Dùng cho Dashboard xem tổng quỹ, thu, chi, số dư đầu kỳ)
-- ================================================================

-- 1. Xóa view cũ (để tránh lỗi xung đột)
DROP VIEW IF EXISTS public.view_public_fund_stats;

-- 2. Tạo View mới (Logic tách Số dư đầu kỳ + Thu mới)
CREATE OR REPLACE VIEW public.view_public_fund_stats 
WITH (security_invoker = true) -- Quan trọng: Chạy theo quyền user
AS
SELECT 
    t.fiscal_year,
    
    -- 1. Số dư đầu kỳ (Lấy riêng dòng có code là OPENING_BALANCE)
    COALESCE(SUM(CASE WHEN fc.code = 'OPENING_BALANCE' THEN t.amount ELSE 0 END), 0) as opening_balance,

    -- 2. Tổng Thu MỚI TRONG NĂM (Trừ cái đầu kỳ ra)
    COALESCE(SUM(CASE WHEN fc.flow_type = 'in' AND fc.code != 'OPENING_BALANCE' AND t.payment_status = 'paid' THEN t.amount ELSE 0 END), 0) as total_revenue,

    -- 3. Tổng Chi TRONG NĂM
    COALESCE(SUM(CASE WHEN fc.flow_type = 'out' AND t.payment_status = 'paid' THEN t.amount ELSE 0 END), 0) as total_expense,

    -- 4. Số dư cuối cùng (Cộng tất cả lại: Đầu kỳ + Thu mới - Chi)
    (
      COALESCE(SUM(CASE WHEN fc.flow_type = 'in' AND t.payment_status = 'paid' THEN t.amount ELSE 0 END), 0) -
      COALESCE(SUM(CASE WHEN fc.flow_type = 'out' AND t.payment_status = 'paid' THEN t.amount ELSE 0 END), 0)
    ) as current_balance

FROM public.transactions t
JOIN public.financial_categories fc ON t.category_id = fc.id
WHERE t.payment_status = 'paid'
GROUP BY t.fiscal_year;

-- 3. Cấp quyền đọc (Quan trọng để không bị lỗi 401)
GRANT SELECT ON public.view_public_fund_stats TO authenticated, anon;

-- 3.3. View Chi tiêu Công khai (Minh bạch hóa)
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

--==========-hàm chuyển số dư cuối kỳ thành số dư đầu kỳ cho năm sau================
CREATE OR REPLACE FUNCTION create_opening_balance(prev_year int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    total_in numeric;
    total_out numeric;
    balance numeric;
    cat_opening_id uuid;
    next_year int;
    existing_id uuid; -- Biến để lưu ID nếu đã tồn tại
BEGIN
    next_year := prev_year + 1;

    -- 1. Tính tổng thu năm cũ (Chỉ tính tiền ĐÃ THANH TOÁN)
    SELECT COALESCE(SUM(t.amount), 0) INTO total_in 
    FROM transactions t JOIN financial_categories fc ON t.category_id = fc.id
    WHERE t.fiscal_year = prev_year AND fc.flow_type = 'in' AND t.payment_status = 'paid';

    -- 2. Tính tổng chi năm cũ
    SELECT COALESCE(SUM(t.amount), 0) INTO total_out
    FROM transactions t JOIN financial_categories fc ON t.category_id = fc.id
    WHERE t.fiscal_year = prev_year AND fc.flow_type = 'out' AND t.payment_status = 'paid';

    -- 3. Tính số dư cuối kỳ thực tế
    balance := total_in - total_out;

    -- 4. Lấy ID danh mục Opening Balance
    SELECT id INTO cat_opening_id FROM financial_categories WHERE code = 'OPENING_BALANCE';
    
    IF cat_opening_id IS NULL THEN
        RAISE EXCEPTION 'Chưa cấu hình danh mục có mã OPENING_BALANCE trong bảng categories';
    END IF;

    -- 5. Kiểm tra xem năm mới đã có Opening Balance chưa?
    SELECT id INTO existing_id 
    FROM transactions 
    WHERE fiscal_year = next_year AND category_id = cat_opening_id
    LIMIT 1;

    -- 6. Xử lý Logic rẽ nhánh (UPDATE hoặc INSERT)
    IF existing_id IS NOT NULL THEN
        -- TRƯỜNG HỢP A: Đã có -> Cập nhật lại số tiền (kể cả khi số tiền giảm đi hoặc tăng lên)
        UPDATE transactions
        SET 
            amount = balance,
            description = 'Số dư đầu kỳ từ năm ' || prev_year || ' (Đã cập nhật lại)',
            processed_at = NOW(), -- Cập nhật thời gian mới nhất
            metadata = jsonb_build_object(
                'auto_generated', true, 
                'source_year', prev_year, 
                'last_updated', NOW(),
                'update_reason', 're-calculation'
            )
        WHERE id = existing_id;
        
        -- (Tùy chọn) In ra log để biết
        RAISE NOTICE 'Đã cập nhật lại số dư đầu kỳ năm % thành: %', next_year, balance;
        
    ELSE
        -- TRƯỜNG HỢP B: Chưa có -> Tạo mới (Chỉ tạo nếu số dư > 0)
        IF balance > 0 THEN
            INSERT INTO transactions (
                category_id, 
                amount, 
                description, 
                payment_status, 
                fiscal_year, 
                period_month,
                processed_at,
                metadata
            ) VALUES (
                cat_opening_id,
                balance,
                'Chuyển số dư từ năm ' || prev_year,
                'paid',
                next_year,
                1,
                NOW(),
                jsonb_build_object('auto_generated', true, 'source_year', prev_year)
            );
            
            RAISE NOTICE 'Đã tạo mới số dư đầu kỳ năm % là: %', next_year, balance;
        END IF;
    END IF;
END;
$$;
----------================================================----------------------
-- 4. hàm kiểm tra số dư hiện tại

CREATE OR REPLACE FUNCTION get_club_balance(year_input int)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    total_in numeric;
    total_out numeric;
BEGIN
    -- 1. Tính tổng thu (Chỉ trong năm được chọn)
    SELECT COALESCE(SUM(t.amount), 0) INTO total_in 
    FROM public.transactions t 
    JOIN public.financial_categories fc ON t.category_id = fc.id
    WHERE fc.flow_type = 'in' 
      AND t.payment_status = 'paid'
      AND t.fiscal_year = year_input; -- <--- QUAN TRỌNG: Lọc theo năm

    -- 2. Tính tổng chi (Chỉ trong năm được chọn)
    SELECT COALESCE(SUM(t.amount), 0) INTO total_out
    FROM public.transactions t 
    JOIN public.financial_categories fc ON t.category_id = fc.id
    WHERE fc.flow_type = 'out' 
      AND t.payment_status = 'paid'
      AND t.fiscal_year = year_input; -- <--- QUAN TRỌNG: Lọc theo năm

    -- 3. Trả về số dư của năm đó (Đã bao gồm số dư đầu kỳ nằm trong total_in)
    RETURN total_in - total_out;
END;
$$;

---=========================================================
-- 1. Hàm tính TỔNG CHI trong năm (Chỉ tính đã chi - paid)
CREATE OR REPLACE FUNCTION get_total_expense(year_input int)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    result numeric;
BEGIN
    SELECT COALESCE(SUM(t.amount), 0) INTO result
    FROM public.transactions t 
    JOIN public.financial_categories fc ON t.category_id = fc.id
    WHERE t.fiscal_year = year_input 
      AND t.payment_status = 'paid'
      AND fc.flow_type = 'out'; -- Chỉ lấy khoản CHI
      
    RETURN result;
END;
$$;

-- 2. Hàm tính TỔNG THU THỰC TẾ (Đã trừ số dư đầu kỳ)
-- Logic: Lấy tổng thu MINUS đi khoản có mã 'OPENING_BALANCE'
CREATE OR REPLACE FUNCTION get_total_income_real(year_input int)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    result numeric;
BEGIN
    SELECT COALESCE(SUM(t.amount), 0) INTO result
    FROM public.transactions t 
    JOIN public.financial_categories fc ON t.category_id = fc.id
    WHERE t.fiscal_year = year_input 
      AND t.payment_status = 'paid'
      AND fc.flow_type = 'in'       -- Chỉ lấy khoản THU
      AND fc.code <> 'OPENING_BALANCE'; -- <--- QUAN TRỌNG: Loại bỏ số dư đầu kỳ
      
    RETURN result;
END;
$$;

-- 3. Hàm tính TỔNG PHẢI THU (Pending)
-- Logic: Các khoản THU nhưng trạng thái là 'pending' (Chưa đóng tiền)
CREATE OR REPLACE FUNCTION get_total_pending_income(year_input int)
RETURNS numeric
LANGUAGE plpgsql
AS $$
DECLARE
    result numeric;
BEGIN
    SELECT COALESCE(SUM(t.amount), 0) INTO result
    FROM public.transactions t 
    JOIN public.financial_categories fc ON t.category_id = fc.id
    WHERE t.fiscal_year = year_input 
      AND t.payment_status = 'pending' -- Trạng thái chưa thanh toán
      AND fc.flow_type = 'in';         -- Chỉ tính khoản Thu
      
    RETURN result;
END;
$$;

-- 4. CẤP QUYỀN CHẠY HÀM (Bắt buộc)
GRANT EXECUTE ON FUNCTION get_total_expense(int) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_total_income_real(int) TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION get_total_pending_income(int) TO authenticated, anon, service_role;
-- =================================================================
