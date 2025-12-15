"use client";

export default function AuthVerifying() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--color-primary)" }}></div>
        <h2 className="text-xl font-semibold mb-2">Đang xác thực phiên...</h2>
        <p className="text-sm text-gray-600">Vui lòng chờ một chút — kiểm tra thông tin đăng nhập từ máy chủ.</p>
      </div>
    </div>
  );
}
