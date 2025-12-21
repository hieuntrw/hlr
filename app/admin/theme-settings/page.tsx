"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/theme";
import { useAuth } from "@/lib/auth/AuthContext";
import { getEffectiveRole, isAdminRole } from "@/lib/auth/role";
import { Theme } from "@/lib/theme/types";
import { defaultTheme, blueTheme, greenTheme } from "@/lib/theme/defaultTheme";
// icons removed (unused)

export default function AdminThemeSettingsPage() {
  const { user, isLoading: authLoading, sessionChecked } = useAuth();
  const router = useRouter();
  const { theme, setTheme, applyCustomizations, resetTheme, saveUserPreference, loadThemePresets } = useTheme();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  type SystemSettings = {
    default_theme_id: string;
    dark_mode_enabled: boolean;
    allow_user_themes: boolean;
    allow_user_dark_mode: boolean;
    allow_user_font_size: boolean;
  };

  // System settings
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    default_theme_id: 'hlr-default',
    dark_mode_enabled: true,
    allow_user_themes: true,
    allow_user_dark_mode: true,
    allow_user_font_size: true,
  });

  // Preset themes
  const presetThemes = [
    { id: "default", name: "Orange (Default)", theme: defaultTheme },
    { id: "blue", name: "Blue Theme", theme: blueTheme },
    { id: "green", name: "Green Theme", theme: greenTheme },
  ];

  const loadSystemSettings = useCallback(async () => {
    try {
      const resp = await fetch('/api/admin/theme-settings', { credentials: 'same-origin' });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        console.error('Error loading system settings:', json);
        return;
      }
      const sys = json.systemSettings || {
        default_theme_id: 'hlr-default',
        dark_mode_enabled: true,
        allow_user_themes: true,
        allow_user_dark_mode: true,
        allow_user_font_size: true,
      };
      setSystemSettings(sys);
    } catch (error) {
      console.error("Error loading system settings:", error);
    }
  }, []);

  const checkAdminStatus = useCallback(async () => {
    try {
      if (!user) {
        router.replace("/login");
        return;
      }

      const resolved = getEffectiveRole(user) || 'member';
      if (!isAdminRole(resolved)) {
        router.replace("/");
        return;
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
      router.replace("/");
    } finally {
      setLoading(false);
    }
  }, [user, router]);

  useEffect(() => {
    if (authLoading || !sessionChecked) return;
    checkAdminStatus();
    loadThemePresets();
    loadSystemSettings();
  }, [authLoading, sessionChecked, checkAdminStatus, loadThemePresets, loadSystemSettings]);

  // resolved role computed after session/loading to avoid premature checks

  const resolvedRole = getEffectiveRole(user) || 'member';
  const isAdminResolved = isAdminRole(resolvedRole);

  const handlePresetTheme = (presetTheme: Theme) => {
    setTheme(presetTheme);
    setMessage("Theme preset đã được áp dụng. Nhấn 'Lưu' để lưu thay đổi.");
  };

  const handleColorChange = (colorKey: keyof Theme["colors"], value: string) => {
    applyCustomizations({
      colors: {
        ...theme.colors,
        [colorKey]: value,
      },
    });
  };

  const handleFontSizeChange = (sizeKey: keyof Theme["fonts"]["fontSize"], value: string) => {
    applyCustomizations({
      fonts: {
        ...theme.fonts,
        fontSize: {
          ...theme.fonts.fontSize,
          [sizeKey]: value,
        },
      },
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      await saveUserPreference();
      setMessage("✅ Theme đã được lưu thành công!");
    } catch (error) {
      console.error("Error saving theme:", error);
      setMessage("❌ Có lỗi khi lưu theme. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (confirm("Bạn có chắc muốn reset về theme mặc định?")) {
      resetTheme();
      setMessage("Theme đã được reset về mặc định.");
    }
  };

  const handleSaveSystemSettings = async () => {
    setSaving(true);
    setMessage("");

    try {
      const resp = await fetch('/api/admin/theme-settings', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'updateSystem', settings: systemSettings }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(json?.error || resp.statusText);
      }
      setMessage('✅ Cài đặt hệ thống đã được lưu!');
    } catch (error) {
      console.error("Error saving system settings:", error);
      setMessage("❌ Có lỗi khi lưu cài đặt. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePresetActive = async (presetId: string, currentStatus: boolean) => {
    try {
      const resp = await fetch('/api/admin/theme-settings', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'togglePreset', id: presetId, is_active: !currentStatus }),
      });
      const json = await resp.json().catch(() => null);
      if (!resp.ok) {
        throw new Error(json?.error || resp.statusText);
      }

      await loadSystemSettings();
      setMessage('✅ Cập nhật theme preset thành công!');
    } catch (error) {
      console.error("Error toggling preset:", error);
      setMessage("❌ Có lỗi khi cập nhật preset.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 mx-auto mb-4" style={{ borderColor: "var(--color-primary)" }}></div>
          <p className="text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (!isAdminResolved) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Cấu Hình Theme</h1>
          <p className="text-gray-600">Tùy chỉnh màu sắc, font chữ và kích thước cho hệ thống</p>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.includes("✅") ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
          }`}>
            {message}
          </div>
        )}

        {/* Preset Themes */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01"/>
            </svg>
            Theme Có Sẵn
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {presetThemes.map((preset) => (
              <button
                key={preset.id}
                onClick={() => handlePresetTheme(preset.theme)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  theme.id === preset.theme.id
                    ? ""
                    : "border-gray-200 hover:border-gray-300"
                }`}
                style={theme.id === preset.theme.id ? { borderColor: "var(--color-primary)", background: "rgba(var(--color-primary-rgb, 249 115 22), 0.1)" } : {}}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: preset.theme.colors.primary }}
                  ></div>
                  <span className="font-semibold">{preset.name}</span>
                </div>
                <div className="flex gap-2">
                  <div
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: preset.theme.colors.primary }}
                  ></div>
                  <div
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: preset.theme.colors.accent }}
                  ></div>
                  <div
                    className="w-6 h-6 rounded"
                    style={{ backgroundColor: preset.theme.colors.success }}
                  ></div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Admin-only preset controls */}
        {isAdminResolved && (
          <div className="bg-white rounded-xl shadow-md p-4 mb-6">
            <h3 className="font-semibold mb-2">Quản lý Preset (Admin)</h3>
            <div className="flex gap-2 flex-wrap">
              {presetThemes.map((p) => (
                <button
                  key={p.id + "-toggle"}
                  onClick={() => handleTogglePresetActive(p.id, false)}
                  className="px-3 py-1 rounded-md border border-gray-200 text-sm hover:bg-gray-50"
                >
                  Chuyển đổi: {p.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Color Customization */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2v10l4.24 4.24"/>
            </svg>
            Tùy Chỉnh Màu Sắc
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(theme.colors).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={value}
                  onChange={(e) => handleColorChange(key as keyof Theme["colors"], e.target.value)}
                  className="w-12 h-12 rounded cursor-pointer"
                />
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 block">{key}</label>
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleColorChange(key as keyof Theme["colors"], e.target.value)}
                    className="w-full text-xs text-gray-600 bg-gray-50 px-2 py-1 rounded border border-gray-200"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Font Size Customization */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
            </svg>
            Kích Thước Font Chữ
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(theme.fonts.fontSize).map(([key, value]) => (
              <div key={key} className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 w-20">{key}:</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => handleFontSizeChange(key as keyof Theme["fonts"]["fontSize"], e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2"
                  placeholder="e.g., 1rem"
                />
                <span className="text-gray-500" style={{ fontSize: value }}>Aa</span>
              </div>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">Preview</h2>
          <div className="space-y-4">
            {/* Gradient Header Preview */}
            <div className="gradient-theme-primary rounded-lg p-4 shadow-theme-lg">
              <h3 className="text-2xl font-bold text-white flex items-center gap-3">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Section Header Preview
              </h3>
            </div>

            {/* Button Preview */}
            <div className="flex gap-3">
              <button className="bg-theme-primary text-white px-4 py-2 rounded-lg shadow-theme">
                Primary Button
              </button>
              <button className="bg-theme-accent text-gray-800 px-4 py-2 rounded-lg shadow-theme">
                Accent Button
              </button>
            </div>

            {/* Text Preview */}
            <div className="space-y-2">
              <p className="text-theme-primary font-bold" style={{ fontSize: theme.fonts.fontSize['2xl'] }}>
                Heading Text
              </p>
              <p className="text-gray-600" style={{ fontSize: theme.fonts.fontSize.base }}>
                Body text với size chuẩn. Lorem ipsum dolor sit amet, consectetur adipiscing elit.
              </p>
              <p className="text-gray-500" style={{ fontSize: theme.fonts.fontSize.sm }}>
                Small text for captions and secondary information.
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 text-white px-6 py-3 rounded-lg font-semibold transition-colors disabled:opacity-50"
            style={{ background: "var(--color-primary)" }}
            onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            {saving ? "Đang lưu..." : "💾 Lưu Theme"}
          </button>
          <button
            onClick={handleReset}
            className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
          >
            🔄 Reset
          </button>
          {isAdminResolved && (
            <button
              onClick={handleSaveSystemSettings}
              disabled={saving}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              {saving ? "Đang lưu..." : "💾 Lưu Cài Đặt Hệ Thống"}
            </button>
          )}
        </div>

        {/* Info */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>💡 Lưu ý:</strong> Theme sẽ được lưu vào database và áp dụng cho tài khoản của bạn. 
            Trong tương lai, có thể cho phép user tùy chỉnh theme riêng hoặc admin đặt theme mặc định cho toàn hệ thống.
          </p>
        </div>
      </div>
    </div>
  );
}
