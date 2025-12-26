# Authentication & Authorization - Business Logic Audit

This document summarizes the authentication/authorization related business logic found in the codebase (paths: `app/api/auth/*`, `lib/auth/*`, and related helpers in `lib/`). Each section describes a single "nghiệp vụ" (operation), its responsibilities, inputs/outputs, session/cookie handling, important edge cases and recommended improvements.

---

**1) Client-side auth context**
- File: `lib/auth/AuthContext.tsx`
- Purpose: Provide React context for `user` and `profile`, keep client-side Supabase client in sync with server session, expose `refreshAuth()` and `sessionChecked`.
- Main flow:
  - Try `supabase.auth.getUser()` (browser client).
  - If missing, call `/api/auth/whoami` to reconstruct server-side user.
  - If whoami returns a user but browser client lacks session, call `/api/auth/restore` to get access_token and then `supabase.auth.setSession`.
  - Fetch `profiles/:id` to populate `profile` shape used in UI.
  - Subscribe to `supabase.auth.onAuthStateChange` to refresh on sign-in/out.
- Cookies / session handling:
  - Relies on HttpOnly cookies set by server endpoints (`sb-access-token`, `sb-refresh-token`, `sb-session`).
  - Uses `/api/auth/restore` to read cookie value when client-side supabase lacks an in-memory session.
- Edge cases & notes:
  - Caches profile in `localStorage` for up to 5 minutes to reduce flicker.
  - If `setSession` fails, code still proceeds with reconstructed user returned by whoami.
- Risks / recommendations:
  - `localStorage` cache may expose stale role info; ensure refresh triggers on role-affecting events.
  - Consider explicit handling when `supabase.auth.setSession` returns refresh-rotation errors.

---

**2) Role helpers**
- File: `lib/auth/role.ts`
- Purpose: Provide simple utilities `getEffectiveRole`, `isAdminRole`, `isModRole`.
- Behavior:
  - Reads `user.app_metadata.role` if present, otherwise returns null.
- Recommendation:
  - Consider normalizing role strings and centralizing role names as constants for consistency.

---

**3) Client helper to set server session**
- File: `lib/auth/set-session-client.ts`
- Purpose: After client-side sign-in (e.g., via Supabase JS), call `/api/auth/set-session` to persist HttpOnly cookies.
- Flow: POST `access_token` and optional `refresh_token` to `/api/auth/set-session` and error if the call fails.
- Recommendation:
  - The helper throws a generic error; callers should handle and surface localized messages.

---

**4) Server-side cookie/session decoding & helpers**
- File: `lib/server-auth.ts`
- Operations:
  - `decodeSbSessionCookie(raw)`: parse either a raw JWT (`sb-access-token`) or a URL-encoded JSON session (`sb-session`) and reconstruct a minimal `User` object (id + app_metadata.role).
  - `getUserFromAuthClient(supabaseAuth, getCookie)`: primary server-side method to obtain an authenticated `User`:
    1. Try `supabaseAuth.auth.getUser()`.
    2. If absent and `getCookie` available, try `setSession` from `sb-access-token` & `sb-refresh-token` and retry `getUser()`.
    3. If still absent, parse `sb-session` to reconstruct user and return that.
  - `ensureAdmin(...)`: ensure authenticated user exists and `app_metadata.role` is allowed; permits fallback to `sb-session` parse if no user.
- Security considerations:
  - Fallback to reconstructed `sb-session` cookie is pragmatic for UX (when refresh rotation prevents setSession), but must be understood as less authoritative (it's reading cookie payload without verifying token signature).
  - Ensure `sb-session` contents are written only by trusted server code (they are HttpOnly, but server reconstruct logic assumes their payload is trustworthy).
- Recommendations:
  - Where possible, prefer `supabaseAuth.auth.getUser()` / verified session; restrict reconstructed fallback to read-only info and avoid granting high privilege actions without further checks.
  - Log an audit event when `ensureAdmin` grants via `sb-session` fallback.

---

**5) whoami endpoint**
- File: `app/api/auth/whoami/route.ts`
- Purpose: Reconstruct / return the authenticated user for client-side code when `supabase.auth.getUser()` returns empty.
- Flow:
  1. Create server Supabase client using anon key with cookie helpers.
  2. Try `supabase.auth.getUser()`.
  3. If no user and cookies exist, attempt `supabase.auth.setSession({access,refresh})` then retry `getUser()`.
  4. Final fallback: parse `sb-session` JSON cookie and decode JWT payload to reconstruct id and role.
  5. Return JSON { ok: true | false, user?, cookies?, tokenPreviews? }.
- Notes & risk:
  - Uses anon key to call `setSession` server-side; this is acceptable because the server reconstructs a session from HttpOnly cookies, but `setSession` will fail if refresh token rotated/invalid.
  - Parsing `sb-session` as last resort reintroduces same trust caveat as `decodeSbSessionCookie`.
- Recommendations:
  - Keep this endpoint `force-dynamic` and ensure logging of fallback paths; consider returning less sensitive payload (avoid echoing full tokens in logs).

---

**6) restore endpoint**
- File: `app/api/auth/restore/route.ts`
- Purpose: Return `sb-access-token` from request cookie header to allow client-side `supabase.auth.setSession` when the browser client has no in-memory session.
- Flow: read `cookie` header, extract `sb-access-token` and return JSON { ok:true, access_token } or 404 when missing.
- Security note: This endpoint exposes the access token into the JSON response to the same-origin caller; it's intended for browser client use immediately after login. Keep CSRF protections in mind (same-origin `credentials: 'same-origin'` is used by client code).

---

**7) set-session endpoint**
- File: `app/api/auth/set-session/route.ts`
- Purpose: Server-side endpoint to set HttpOnly cookies (`sb-access-token`, `sb-refresh-token`, `sb-session`). Used by client after sign-in or other flows.
- Flow: Accept POST { access_token, refresh_token }, determine `secure` flag from `x-forwarded-proto` / NODE_ENV / FORCE_COOKIE_SECURE, set cookies with appropriate options.
- Recommendation:
  - Cookie options look correct; ensure `COOKIE_DOMAIN` handling matches production reverse-proxy expectations.

---

**8) email-login endpoint**
- File: `app/api/auth/email-login/route.ts`
- Purpose: Authenticate user via Supabase Auth (email+password), set server HttpOnly cookies and return user metadata.
- Flow:
  1. Accept JSON or form data with `email` and `password`.
  2. Use client anon key (`createClient` with NEXT_PUBLIC_ANON_KEY) to call `supabase.auth.signInWithPassword`.
  3. On success, ensure a minimal `profiles` row exists; upsert if missing.
  4. Attach `sb-access-token`, `sb-refresh-token`, and `sb-session` HttpOnly cookies on the response.
  5. If request prefers HTML (form post), do a 303 redirect while re-setting cookies on the redirect response.
- Notes & rationale:
  - Using anon key here is common: sign-in requires the public anon client.
  - The flow creates/ensures profile to avoid PostgREST `single()` errors.
- Security & UX:
  - Cookie secure logic depends on forwarded protocol; `FORCE_COOKIE_SECURE` env var is available to override.
- Recommendation:
  - Consider rate-limiting and explicit audit logging for failed login attempts.

---

**9) signup endpoint**
- File: `app/api/auth/signup/route.ts`
- Purpose: Create a Supabase Auth user and profile using the service-role key.
- Flow:
  - Uses `SUPABASE_SERVICE_ROLE_KEY` (server-only) to call `supabase.auth.signUp` and then `profiles.upsert`.
- Notes:
  - This is an admin/server action — correct to use service role.
  - The route sets `is_active` and `join_date` on profile upsert.
- Recommendation:
  - Validate input more strictly and consider email verification options depending on product policy.

---

**10) logout endpoint**
- File: `app/api/auth/logout/route.ts`
- Purpose: Revoke server-side session (call `supabase.auth.signOut()` server-side) and clear all known `sb-*` cookies and `supabase-auth-token`.
- Flow:
  - Attempts `supabase.auth.signOut()` then creates response clearing cookies (expires in the past).
- Recommendation:
  - This is appropriate; ensure that signOut errors are non-fatal (they are currently only logged).

---

**11) Strava auth redirects (deprecated wrappers)**
- Files:
  - `app/api/auth/strava/login/route.ts` (redirects to `/api/strava/connect/login`)
  - `app/api/auth/strava/callback/route.ts` (redirects to `/api/strava/connect/callback`)
- Purpose: Lightweight redirect endpoints that forward to real Strava connect routes.

---

**12) Change-password flow**
- Files:
  - Client: `app/profile/change-password/page.tsx` (UI shows member `profile.full_name`)
  - Server: `app/api/profile/change-password/route.ts` (server-side)
- Server behavior summary:
  - Validates password strength and requires `oldPassword` and `newPassword`.
  - Uses `createServerClient` and `getUserFromAuthClient` to reconstruct the user from cookies.
  - Ensures `profiles` row exists for `user.id` (we changed to check existence) and then calls `supabase.auth.updateUser({ password })` using server client (session preserved by cookies).
- Important note:
  - The route originally used anon client to verify `oldPassword`; it was changed to rely on cookie-based authentication and presence of profile. This is more secure because it avoids sending old password over anon re-auth flows.
- Recommendation:
  - If you must verify `oldPassword`, prefer using a secure server-side reauthentication API that verifies credentials against the auth provider without leaking tokens; otherwise rely on session validity and require re-login for sensitive operations.

---

## Cross-cutting observations & recommendations
- Cookie model: The code uses three related cookies: `sb-access-token` (JWT), `sb-refresh-token`, and `sb-session` (JSON payload). `sb-session` is used as a pragmatic fallback to reconstruct user when refresh token rotation prevents `setSession`.
  - Risk: `sb-session` payload is not cryptographically verified when parsed server-side. It's only as trustworthy as the server code that wrote it (which is the same app), but treat fallback as less authoritative.
- Use of anon key vs service role:
  - `email-login` uses anon key (correct) to sign in.
  - `signup` uses service role (correct).
  - Do not use anon key for privileged operations.
- Privilege elevation via fallback:
  - `ensureAdmin` can grant access via `sb-session` fallback; log and monitor such grants. Consider additional checks (e.g., read-only vs mutation) if reconstruction is used.
- Logging & monitoring:
  - There are many debug/log calls (`serverDebug.debug/info/warn/error`) — ensure production logging sanitizes token values and doesn't leak secrets.
- CSRF/Origin concerns:
  - The restore endpoint returns the raw access token from cookie header into JSON; ensure callers use `credentials: 'same-origin'` and that top-level app enforces same-origin policy and secure cookie flags in production.

---

## Files Reviewed
- `lib/auth/AuthContext.tsx`
- `lib/auth/index.ts`
- `lib/auth/role.ts`
- `lib/auth/set-session-client.ts`
- `lib/server-auth.ts`
- `app/api/auth/whoami/route.ts`
- `app/api/auth/restore/route.ts`
- `app/api/auth/set-session/route.ts`
- `app/api/auth/email-login/route.ts`
- `app/api/auth/signup/route.ts`
- `app/api/auth/logout/route.ts`
- `app/api/auth/strava/login/route.ts`
- `app/api/auth/strava/callback/route.ts`
- `app/api/profile/change-password/route.ts`
- `app/profile/change-password/page.tsx`


---

If you'd like, I can:
- Expand this report with exact code snippets per operation (e.g., exact cookie options used).
- Add a short checklist of unit/integration tests to validate each critical flow (whoami, restore, set-session, login, logout, ensureAdmin edge paths).
- Create a PR with small hardening changes (audit logs when fallback used, stricter token handling).

Tell me which next step you prefer and I will proceed.




Dựa trên tài liệu AUTH_BUSINESS_LOGIC.md bạn cung cấp, tôi đã rà soát lại toàn bộ luồng nghiệp vụ xác thực (Authentication) và phân quyền (Authorization) của dự án.

Dưới đây là bản đánh giá chi tiết và các khuyến nghị cụ thể để vá lỗ hổng bảo mật và tối ưu hóa hệ thống.

1. Đánh giá Tổng quan
Hệ thống hiện tại đang sử dụng mô hình Hybrid (Lai): kết hợp giữa Supabase Auth tiêu chuẩn và cơ chế quản lý Cookie tự xây dựng (custom cookie management) để đồng bộ trạng thái giữa Next.js Server (SSR) và Client.

Điểm mạnh:

Sử dụng cookie HttpOnly giúp hạn chế rủi ro XSS so với lưu token ở localStorage.

Có sự phân chia rõ ràng giữa anon key (đăng nhập) và service_role key (tạo user, admin action).

Logic kiểm tra quyền (ensureAdmin) được đặt ở phía server.

Điểm yếu (Rủi ro):

Cơ chế "Fallback" (dự phòng) vào cookie sb-session không được xác thực chữ ký (unverified) là lỗ hổng nguy hiểm nhất.

Cơ chế đồng bộ thủ công (whoami -> restore -> setSession) rất phức tạp và dễ sinh lỗi (race conditions).

2. Các Rủi ro Nghiêm trọng & Khuyến nghị Khắc phục
🔴 Rủi ro 1: Tin tưởng mù quáng vào sb-session (Critical)
Vấn đề: Trong file lib/server-auth.ts, hàm ensureAdmin có thể cho phép user đi qua nếu việc xác thực JWT thất bại nhưng cookie sb-session (JSON thuần) vẫn tồn tại.

Nguy hiểm: Hacker có thể giả mạo cookie sb-session (vì nó không có chữ ký mã hóa của Supabase như JWT) để lừa server rằng mình là Admin. Mặc dù cookie là HttpOnly, nhưng nếu có lỗ hổng set-cookie từ subdomain khác hoặc XSS đọc/ghi cookie (hiếm nhưng có thể), hệ thống sẽ bị qua mặt.

✅ Khuyến nghị:

Chỉ dùng sb-session cho UI (Read-only): Chỉ dùng cookie này để hiển thị giao diện (ví dụ: hiện avatar, tên user).

Cấm dùng cho hành động Ghi/Admin: Với các hàm ensureAdmin hoặc các API thay đổi dữ liệu (POST/PUT/DELETE), BẮT BUỘC phải xác thực bằng supabase.auth.getUser() (check JWT thật sự). Nếu JWT hết hạn, bắt buộc client phải refresh token hoặc đăng nhập lại, tuyệt đối không fallback sang JSON cookie không an toàn.

🟠 Rủi ro 2: Endpoint /api/auth/restore lộ Token
Vấn đề: Endpoint này trả về access_token dạng JSON cho client.

Nguy hiểm: Nếu trang web có lỗ hổng XSS, hacker có thể gọi endpoint này để lấy access_token mới nhất và mang đi gọi API thay cho user.

✅ Khuyến nghị:

Đảm bảo endpoint này có Header bảo mật chặt chẽ.

Kiểm tra kỹ nguồn gốc request (Origin Check) để chống CSRF.

Tốt nhất: Nếu chuyển sang thư viện @supabase/ssr chính chủ, bạn có thể loại bỏ hoàn toàn endpoint này vì thư viện sẽ tự xử lý việc hydrate session từ cookie.

🟡 Rủi ro 3: Logic signup dùng Service Role
Vấn đề: Endpoint signup đang dùng SUPABASE_SERVICE_ROLE_KEY.

Phân tích: Nếu endpoint này là Public (cho người lạ đăng ký), việc dùng Service Role là rủi ro vì nó bỏ qua các giới hạn (Rate Limit, Captcha) mà Supabase áp dụng cho anon key. Nó cũng tốn tài nguyên server hơn.

Trường hợp đúng: Nếu đây là endpoint chỉ dành cho Admin tạo User nội bộ, thì dùng Service Role là đúng.

✅ Khuyến nghị:

Nếu là đăng ký công khai: Hãy chuyển sang dùng anon key (supabase.auth.signUp).

Nếu là Admin tạo user: Hãy bọc endpoint này bằng middleware ensureAdmin thật chặt.

3. Tối ưu hóa Code & Bảo trì
1. Chuẩn hóa Role (Hardcoded Strings)
Vấn đề: File lib/auth/role.ts đang đọc chuỗi thô từ user.app_metadata.role. ✅ Khuyến nghị: Tạo một file constants.ts hoặc enums cho Role.

TypeScript

// lib/constants.ts
export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  MEMBER = 'member'
}
// Sử dụng: if (user.app_metadata.role === UserRole.ADMIN)
2. Xử lý bộ nhớ đệm LocalStorage
Vấn đề: AuthContext cache profile trong localStorage 5 phút.

Hệ quả: Nếu Admin hạ quyền user xuống "member", user đó vẫn thấy giao diện Admin trong 5 phút (dù gọi API sẽ lỗi). ✅ Khuyến nghị: Xóa cache localStorage ngay lập tức khi phát hiện sự kiện SIGNED_OUT hoặc khi API trả về lỗi 403 Forbidden.

3. Chuyển đổi sang @supabase/ssr (Long-term)
Hệ thống hiện tại đang tự viết lại logic quản lý cookie (set-session, restore, whoami). Đây là "Technical Debt" (nợ kỹ thuật) lớn. Supabase đã ra mắt thư viện @supabase/ssr thay thế cho cách làm thủ công này. Nó tự động xử lý set-cookie, refresh token và xác thực server-side an toàn hơn.

Lộ trình đề xuất:

Giữ nguyên hệ thống hiện tại để chạy dự án.

Vá lỗ hổng ensureAdmin (Rủi ro 1) ngay lập tức.

Lên kế hoạch refactor (tái cấu trúc) code auth chuyển sang @supabase/ssr trong tương lai gần để loại bỏ các file lib/server-auth.ts, restore/route.ts, set-session/route.ts.

Tổng kết Checklist hành động ngay:
[ ] Audit lib/server-auth.ts: Sửa hàm ensureAdmin. Nếu getUser() thất bại -> Trả về lỗi (Throw Error), không return user từ sb-session.

[ ] Audit signup/route.ts: Xác định rõ là Public hay Admin-only. Nếu Admin-only, thêm check ensureAdmin ở đầu hàm.

[ ] Audit Logging: Rà soát các hàm serverDebug, đảm bảo không log in ra toàn bộ access_token hay password vào console server.