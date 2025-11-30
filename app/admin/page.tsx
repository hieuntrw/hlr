"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

interface AdminProfile {
  id: string;
  full_name: string;
  role: string;
  avatar_url?: string;
}

interface MenuItem {
  title: string;
  description: string;
  icon: string;
  link: string;
  requiredRoles: string[];
}

export default function AdminPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const menuItems: MenuItem[] = [
    {
      title: "Quản Lý Thu/Chi",
      description: "Theo dõi giao dịch, quỹ và các khoản phí",
      icon: "💰",
      link: "/admin/finance",
      requiredRoles: ["admin", "mod_finance"],
    },
    {
      title: "Báo Cáo Quỹ",
      description: "Xem báo cáo tài chính và thống kê chi tiêu",
      icon: "📊",
      link: "/admin/finance-report",
      requiredRoles: ["admin", "mod_finance"],
    },
    {
      title: "Tạo/Sửa Thử Thách",
      description: "Quản lý danh sách thử thách hàng tháng",
      icon: "🏃",
      link: "/admin/challenges",
      requiredRoles: ["admin", "mod_challenge"],
    },
    {
      title: "Thêm/Sửa Thành Viên",
      description: "Quản lý hồ sơ thành viên và thông tin cá nhân",
      icon: "👥",
      link: "/admin/members",
      requiredRoles: ["admin", "mod_member"],
    },
    {
      title: "Duyệt PB",
      description: "Phê duyệt thành tích cá nhân của thành viên",
      icon: "✅",
      link: "/admin/pb-approval",
      requiredRoles: ["admin", "mod_member"],
    },
    {
      title: "Cài Đặt Hệ Thống",
      description: "Quản lý vai trò, bảng giải thưởng, cấu hình chung",
      icon: "⚙️",
      link: "/admin/settings",
      requiredRoles: ["admin"],
    },
  ];

  useEffect(() => {
    fetchAdminProfile();
  }, []);

  async function fetchAdminProfile() {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/debug-login");
        return;
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name, role, avatar_url")
        .eq("id", user.id)
        .single();

      if (profileError) {
        console.error("Error fetching profile:", profileError);
        setError("Không thể tải hồ sơ");
        return;
      }

      // Check if user has admin/mod roles
      const validRoles = ["admin", "mod_finance", "mod_challenge", "mod_member"];
      if (!profileData?.role || !validRoles.includes(profileData.role)) {
        router.push("/");
        return;
      }

      setProfile(profileData);
    } catch (err) {
      console.error("Unexpected error:", err);
      setError("Có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  }

  const getRoleLabel = (role: string): string => {
    const labels: { [key: string]: string } = {
      admin: "Super Admin",
      mod_finance: "Mod Tài Chính",
      mod_challenge: "Mod Thử Thách",
      mod_member: "Mod Thành Viên",
      member: "Thành Viên",
    };
    return labels[role] || role;
  };

  const getAccessibleMenus = (role: string): MenuItem[] => {
    return menuItems.filter((item) => item.requiredRoles.includes(role));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg">{error}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 text-lg">Bạn không có quyền truy cập trang này</p>
        </div>
      </div>
    );
  }

  const accessibleMenus = getAccessibleMenus(profile.role);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-8 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {profile.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name}
                  className="w-16 h-16 rounded-full object-cover border-4 border-white"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/30 flex items-center justify-center border-4 border-white text-2xl">
                  👤
                </div>
              )}

              <div>
                <h1 className="text-3xl font-bold">{profile.full_name}</h1>
                <p className="text-blue-100 text-lg">
                  🔐 {getRoleLabel(profile.role)}
                </p>
              </div>
            </div>

            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-blue-500 hover:bg-blue-700 rounded-lg transition-colors"
            >
              ← Về Trang Chủ
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Role-based greeting */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            🎯 Bảng Điều Khiển {getRoleLabel(profile.role)}
          </h2>
          <p className="text-gray-600">
            {profile.role === "admin"
              ? "Bạn có toàn quyền quản trị hệ thống"
              : "Chỉ hiển thị các chức năng phù hợp với vai trò của bạn"}
          </p>
        </div>

        {/* Menu Grid */}
        {accessibleMenus.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {accessibleMenus.map((item) => (
              <a
                key={item.link}
                href={item.link}
                className="bg-white rounded-lg shadow-md hover:shadow-lg transition-all hover:translate-y-[-4px] p-6 border-l-4 border-blue-500"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="text-4xl">{item.icon}</div>
                  <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    {item.requiredRoles.join(", ")}
                  </div>
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-600 text-sm mb-4">{item.description}</p>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <span className="text-sm font-semibold text-blue-600">Truy cập →</span>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-lg p-12 text-center shadow-sm">
            <p className="text-gray-500 text-lg">
              Bạn không có quyền truy cập bất kỳ chức năng nào
            </p>
          </div>
        )}

        {/* Role Permissions Info */}
        <div className="mt-12 bg-blue-50 rounded-lg p-6 border-l-4 border-blue-500">
          <h3 className="text-lg font-bold text-blue-900 mb-4">📋 Thông Tin Quyền Hạn</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="font-semibold text-blue-900">Super Admin 🔐</p>
              <p className="text-sm text-blue-700">Toàn quyền quản trị</p>
            </div>
            <div>
              <p className="font-semibold text-green-900">Mod Tài Chính 💰</p>
              <p className="text-sm text-green-700">Quản lý thu/chi, báo cáo</p>
            </div>
            <div>
              <p className="font-semibold text-orange-900">Mod Thử Thách 🏃</p>
              <p className="text-sm text-orange-700">CRUD thử thách</p>
            </div>
            <div>
              <p className="font-semibold text-purple-900">Mod Thành Viên 👥</p>
              <p className="text-sm text-purple-700">Duyệt PB, quản lý thành viên</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
