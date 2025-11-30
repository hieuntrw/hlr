"use client";

export default function AdminPage() {
  return (
    <div className="p-4 md:p-8">
      <h1 className="text-3xl font-bold mb-6">Khu Vực Quản Trị</h1>

      <div className="space-y-6">
        {/* Mod Finance */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4">📊 Quản Lý Tài Chính (Mod Finance)</h2>
          <p className="text-gray-600 mb-4">Quản lý quỹ, phí, giao dịch</p>
          {/* TODO: Financial dashboard - view transactions, manage fees */}
        </section>

        {/* Mod Challenges */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4">🏃 Quản Lý Thử Thách (Mod Challenge)</h2>
          <p className="text-gray-600 mb-4">Tạo, chỉnh sửa thử thách, xem tiến độ</p>
          {/* TODO: Challenge management - CRUD challenges, view participants */}
        </section>

        {/* Mod Member */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4">👥 Quản Lý Thành Viên (Mod Member)</h2>
          <p className="text-gray-600 mb-4">Quản lý hội viên, phê duyệt PB, xử lý miễn trừ</p>
          {/* TODO: Member management - approve PBs, handle excuses, manage roles */}
        </section>

        {/* Super Admin */}
        <section className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-bold mb-4">⚙️ Cài Đặt Hệ Thống (Admin Only)</h2>
          <p className="text-gray-600 mb-4">Cấu hình hệ thống, phân quyền, cài đặt chung</p>
          {/* TODO: System settings, role management, reward matrix config */}
        </section>
      </div>
    </div>
  );
}
