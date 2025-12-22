-- =================================================================
-- 1. THÊM DANH MỤC "SỐ DƯ ĐẦU KỲ"
-- =================================================================
INSERT INTO public.financial_categories (name, code, flow_type, is_recurring, description)
VALUES ('Số dư đầu kỳ', 'OPENING_BALANCE', 'in', false, 'Tiền tồn quỹ từ năm trước chuyển sang')
ON CONFLICT (code) DO NOTHING;

-- =================================================================
-- 2. TẠO HÀM CHỐT SỔ CUỐI NĂM (AUTO CLOSING)
-- =================================================================
-- Hàm này sẽ tính toán dư cuối năm cũ và tạo 1 giao dịch 'OPENING_BALANCE' cho năm mới
CREATE OR REPLACE FUNCTION public.create_opening_balance(prev_year int)
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

    -- 3. Tính số dư cuối kỳ
    balance := total_in - total_out;

    -- 4. Lấy ID danh mục Opening Balance
    SELECT id INTO cat_opening_id FROM financial_categories WHERE code = 'OPENING_BALANCE';

    -- 5. Kiểm tra xem năm mới đã có Opening Balance chưa (tránh chạy 2 lần bị dup)
    IF EXISTS (SELECT 1 FROM transactions WHERE fiscal_year = next_year AND category_id = cat_opening_id) THEN
        RAISE EXCEPTION 'Năm % đã có số dư đầu kỳ rồi!', next_year;
    END IF;

    -- 6. Tạo giao dịch Số dư đầu kỳ cho năm mới (Chỉ tạo nếu số dư > 0)
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
            'paid',       -- Đã có tiền sẵn
            next_year,    -- Thuộc về năm mới
            1,            -- Tháng 1
            NOW(),
            jsonb_build_object('auto_generated', true, 'source_year', prev_year)
        );
    END IF;
END;
$$;

-- =================================================================
-- 3. CẬP NHẬT VIEW BÁO CÁO (TÁCH SỐ DƯ ĐẦU KỲ)
-- =================================================================
CREATE OR REPLACE VIEW public.view_public_fund_stats AS
SELECT 
    t.fiscal_year,
    
    -- 1. Số dư đầu kỳ (Lấy riêng dòng OPENING_BALANCE)
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

CREATE OR REPLACE VIEW public.view_finance_report_by_category 
WITH (security_invoker = true) -- Quan trọng: Dùng quyền của user đang đăng nhập
AS
SELECT 
    fc.id as category_id,
    fc.name as category_name,
    fc.code as category_code,
    fc.flow_type, -- 'in' (Thu) hoặc 'out' (Chi)
    t.fiscal_year,
    COUNT(t.id) as transaction_count, -- Đếm số giao dịch
    COALESCE(SUM(t.amount), 0) as total_amount -- Tổng tiền
FROM 
    public.transactions t
JOIN 
    public.financial_categories fc ON t.category_id = fc.id
WHERE 
    t.payment_status = 'paid' -- CHỈ TÍNH TIỀN ĐÃ THỰC THU/CHI
GROUP BY 
    fc.id, fc.name, fc.code, fc.flow_type, t.fiscal_year;

-- Bước 1.3: Cấp quyền đọc
GRANT SELECT ON public.view_finance_report_by_category TO authenticated;
-- =================================================================

--Xóa các policy bảng transactions cũ không còn dùng nữa

DROP POLICY IF EXISTS "Public View Transactions" ON transactions;
DROP POLICY IF EXISTS "Finance read all" ON transactions;
DROP POLICY IF EXISTS "Mod Finance Insert/Update" ON transactions;
DROP POLICY IF EXISTS "Finance write" ON transactions;
DROP POLICY IF EXISTS "Service Role Full Access" ON transactions;
DROP POLICY IF EXISTS "Members read own transactions" ON transactions;
DROP POLICY IF EXISTS "Finance update" ON transactions;
DROP POLICY IF EXISTS "Users read own transactions" ON transactions;
DROP POLICY IF EXISTS "Admins and mod_finance read all transactions" ON transactions;
DROP POLICY IF EXISTS "Admins and mod_finance create transactions" ON transactions;
DROP POLICY IF EXISTS "Admins and mod_finance update transactions" ON transactions;
DROP POLICY IF EXISTS "Admins delete transactions" ON transactions;
DROP POLICY IF EXISTS "Admins read all transactions" ON transactions;
DROP POLICY IF EXISTS "Admins create transactions" ON transactions;
DROP POLICY IF EXISTS "Admins update transactions" ON transactions;
DROP POLICY IF EXISTS "admin_update_transactions" ON transactions;


--==========================Tạo lại Policy  bảng transactions mới tối ưu ==========================


-- 1. Cho phép Service Role (Backend) làm mọi thứ
CREATE POLICY "Service Role Full Access"
ON public.transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. ADMIN: Quyền lực tuyệt đối (Làm gì cũng được)
CREATE POLICY "Admin Full Access"
ON public.transactions
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

-- 3. MOD FINANCE: Được Xem, Thêm, Sửa (Không được Xóa)
-- Áp dụng cho SELECT, INSERT, UPDATE
CREATE POLICY "Finance Mod Read Write"
ON public.transactions
FOR ALL
TO authenticated
USING (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'mod_finance'
  AND (current_user != 'delete_user') -- Chặn quyền DELETE bằng logic ứng dụng hoặc tách policy nếu cần kỹ hơn
)
WITH CHECK (
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'mod_finance'
);
-- Lưu ý: Policy trên cho phép cả DELETE nếu dùng FOR ALL. 
-- Để an toàn hơn cho Finance (chặn xóa), ta nên tách riêng như sau:

-- (Tối ưu lại cho Finance - Chạy cái này thay cho cái số 3 ở trên)
CREATE POLICY "Finance Mod Manage"
ON public.transactions
FOR INSERT
TO authenticated
WITH CHECK ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'mod_finance' );

CREATE POLICY "Finance Mod Update"
ON public.transactions
FOR UPDATE
TO authenticated
USING ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'mod_finance' )
WITH CHECK ( (auth.jwt() -> 'app_metadata' ->> 'role') = 'mod_finance' );

-- 4. VIEW (GỘP): Quy định ai được xem cái gì
-- Admin/Finance: Xem tất cả.
-- User thường: Chỉ xem của mình.
CREATE POLICY "View Transactions Logic"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  -- Admin hoặc Finance được xem hết
  (auth.jwt() -> 'app_metadata' ->> 'role') IN ('admin', 'mod_finance')
  OR
  -- User thường chỉ xem dòng có user_id trùng với mình
  (user_id = auth.uid())
);