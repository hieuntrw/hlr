"use client";

import { useState, useEffect } from "react";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/lib/supabase-client";
import { useAuth } from "@/lib/auth/AuthContext";
import { Moon, Sun, Palette, Settings, Save, RotateCcw } from "lucide-react";

export default function UserThemeSettingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const {
    theme,
    setTheme,
    darkMode,
    toggleDarkMode,
    useSystemTheme,
    setUseSystemTheme,
    themePresets,
    loadThemePresets,
    saveUserPreference,
    applyCustomizations,
  } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [systemSettings, setSystemSettings] = useState<any>(null);

  useEffect(() => {
    checkUser();
    loadThemePresets();
    loadSystemSettings();
  }, [user, authLoading]);

  const checkUser = async () => {
    // Wait for auth to finish loading
    if (authLoading) {
      setLoading(false);
      return;
    }
    
    try {
      // user from AuthContext
      if (!user) {
        window.location.href = "/login";
        return;
      }
      // user already available from AuthContext
    } catch (error) {
      console.error("Error checking user:", error);
      window.location.href = "/login";
    } finally {
      setLoading(false);
    }
  };

  const loadSystemSettings = async () => {
    try {
      const { data } = await supabase
        .from("system_theme_settings")
        .select("*")
        .single();
      
      if (data) {
        setSystemSettings(data);
      }
    } catch (error) {
      console.error("Error loading system settings:", error);
    }
  };

  const handleThemeSelect = (selectedTheme: any) => {
    setTheme(selectedTheme);
    setUseSystemTheme(false);
    setMessage("Theme đã được chọn. Nhấn 'Lưu' để lưu thay đổi.");
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      await saveUserPreference();
      setMessage("✅ Cài đặt theme đã được lưu!");
    } catch (error) {
      console.error("Error saving:", error);
      setMessage("❌ Có lỗi khi lưu. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSystemTheme = () => {
    setUseSystemTheme(!useSystemTheme);
    setMessage("Đã chuyển sang " + (!useSystemTheme ? "theme hệ thống" : "theme tùy chỉnh"));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--color-primary)" }}></div>
          <p style={{ color: "var(--color-text-secondary)" }}>Đang tải...</p>
        </div>
      </div>
    );
  }

  const canCustomize = systemSettings?.allow_user_themes ?? true;
  const canToggleDarkMode = systemSettings?.allow_user_dark_mode ?? true;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
            <Palette className="w-8 h-8 text-orange-600" />
            Cài Đặt Giao Diện
          </h1>
          <p className="text-gray-600">Tùy chỉnh màu sắc và giao diện theo sở thích của bạn</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes("✅") ? "bg-green-50 text-green-800" : "bg-blue-50 text-blue-800"
          }`}>
            {message}
          </div>
        )}

        {/* Dark Mode Toggle */}
        {canToggleDarkMode && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              {darkMode ? <Moon className="w-6 h-6" /> : <Sun className="w-6 h-6" />}
              Chế Độ Tối
            </h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-700 mb-1">
                  {darkMode ? "Chế độ tối đang bật" : "Chế độ sáng đang bật"}
                </p>
                <p className="text-sm text-gray-500">
                  Bảo vệ mắt khi sử dụng ban đêm
                </p>
              </div>
              <button
                onClick={toggleDarkMode}
                className={`relative inline-flex h-12 w-24 items-center rounded-full transition-colors ${
                  darkMode ? "bg-orange-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-10 w-10 transform rounded-full bg-white transition-transform ${
                    darkMode ? "translate-x-12" : "translate-x-1"
                  }`}
                >
                  {darkMode ? (
                    <Moon className="w-6 h-6 m-2 text-orange-600" />
                  ) : (
                    <Sun className="w-6 h-6 m-2 text-gray-400" />
                  )}
                </span>
              </button>
            </div>
          </div>
        )}

        {/* System Theme Toggle */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Settings className="w-6 h-6" />
            Nguồn Theme
          </h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-700 mb-1">
                {useSystemTheme ? "Sử dụng theme mặc định hệ thống" : "Sử dụng theme tùy chỉnh"}
              </p>
              <p className="text-sm text-gray-500">
                {useSystemTheme 
                  ? "Theme được admin cấu hình cho toàn bộ hệ thống"
                  : "Theme được bạn tùy chỉnh riêng"
                }
              </p>
            </div>
            <button
              onClick={handleToggleSystemTheme}
              disabled={!canCustomize}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                useSystemTheme
                  ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                  : "bg-orange-100 text-orange-700 hover:bg-orange-200"
              } disabled:opacity-50`}
            >
              {useSystemTheme ? "Tùy chỉnh riêng" : "Dùng mặc định"}
            </button>
          </div>
        </div>

        {/* Theme Presets */}
        {!useSystemTheme && canCustomize && (
          <div className="bg-white rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Chọn Theme Có Sẵn</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {themePresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => handleThemeSelect(preset)}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    theme.id === preset.id
                      ? "border-orange-600 bg-orange-50"
                      : "border-gray-200 hover:border-gray-300 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-full shadow-md"
                      style={{ backgroundColor: preset.colors.primary }}
                    ></div>
                    <div>
                      <div className="font-semibold text-gray-900">{preset.name}</div>
                      {preset.isDefault && (
                        <span className="text-xs text-gray-500">Hệ thống</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: preset.colors.primary }}
                    ></div>
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: preset.colors.accent }}
                    ></div>
                    <div
                      className="w-8 h-8 rounded"
                      style={{ backgroundColor: preset.colors.success }}
                    ></div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Current Theme Preview */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Xem Trước Theme Hiện Tại</h2>
          <div className="space-y-4">
            {/* Gradient Header */}
            <div className="gradient-theme-primary rounded-lg p-4 shadow-theme-lg">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                {theme.name}
              </h3>
            </div>

            {/* Buttons */}
            <div className="flex gap-3 flex-wrap">
              <button className="bg-theme-primary text-white px-4 py-2 rounded-lg shadow-theme hover:opacity-90">
                Button Primary
              </button>
              <button className="bg-theme-accent text-gray-800 px-4 py-2 rounded-lg shadow-theme hover:opacity-90">
                Button Accent
              </button>
              <button className="border-2 border-theme-primary text-theme-primary px-4 py-2 rounded-lg hover:bg-orange-50">
                Button Outline
              </button>
            </div>

            {/* Text Samples */}
            <div className="space-y-2">
              <p className="text-theme-primary font-bold" style={{ fontSize: theme.fonts.fontSize['2xl'] }}>
                Tiêu đề lớn
              </p>
              <p className="text-gray-700" style={{ fontSize: theme.fonts.fontSize.base }}>
                Đây là văn bản thông thường với kích thước chuẩn. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
              </p>
              <p className="text-gray-500" style={{ fontSize: theme.fonts.fontSize.sm }}>
                Văn bản nhỏ cho chú thích và thông tin phụ.
              </p>
            </div>

            {/* Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800 font-semibold">Success Card</p>
                <p className="text-sm text-green-600 mt-1">Thao tác thành công</p>
              </div>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-yellow-800 font-semibold">Warning Card</p>
                <p className="text-sm text-yellow-600 mt-1">Cảnh báo quan trọng</p>
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800 font-semibold">Info Card</p>
                <p className="text-sm text-blue-600 mt-1">Thông tin hữu ích</p>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-orange-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? "Đang lưu..." : "Lưu Cài Đặt"}
          </button>
        </div>

        {/* Info */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>💡 Mẹo:</strong> Theme của bạn sẽ được lưu và áp dụng trên tất cả thiết bị khi đăng nhập. 
            Bạn có thể thay đổi bất cứ lúc nào!
          </p>
        </div>

        {!canCustomize && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>⚠️ Lưu ý:</strong> Admin hiện chưa cho phép tùy chỉnh theme cá nhân. 
              Vui lòng liên hệ admin nếu bạn muốn sử dụng tính năng này.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
