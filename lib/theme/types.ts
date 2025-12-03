/**
 * Theme Configuration Types
 * Định nghĩa cấu trúc theme có thể tùy chỉnh bởi admin hoặc user
 */

export interface ThemeColors {
  // Primary colors
  primary: string;
  primaryDark: string;
  primaryLight: string;
  
  // Accent colors
  accent: string;
  accentDark: string;
  accentLight: string;
  
  // Background colors
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  
  // Text colors
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  
  // Status colors
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Border colors
  border: string;
  borderLight: string;
  borderDark: string;
}

export interface ThemeFonts {
  // Font families
  fontFamily: string;
  fontFamilyHeading: string;
  fontFamilyMono: string;
  
  // Font sizes
  fontSize: {
    xs: string;    // 12px
    sm: string;    // 14px
    base: string;  // 16px
    lg: string;    // 18px
    xl: string;    // 20px
    '2xl': string; // 24px
    '3xl': string; // 30px
    '4xl': string; // 36px
    '5xl': string; // 48px
  };
  
  // Font weights
  fontWeight: {
    normal: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  
  // Line heights
  lineHeight: {
    tight: number;
    normal: number;
    relaxed: number;
  };
}

export interface ThemeSpacing {
  // Spacing scale (px)
  space: {
    xs: string;   // 4px
    sm: string;   // 8px
    md: string;   // 16px
    lg: string;   // 24px
    xl: string;   // 32px
    '2xl': string; // 48px
    '3xl': string; // 64px
  };
  
  // Border radius
  radius: {
    sm: string;   // 4px
    md: string;   // 8px
    lg: string;   // 12px
    xl: string;   // 16px
    full: string; // 9999px
  };
  
  // Shadows
  shadow: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
}

export interface Theme {
  id: string;
  name: string;
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: ThemeSpacing;
  // Metadata
  createdBy?: string;
  isDefault?: boolean;
  isCustom?: boolean;
}

export interface UserThemePreference {
  userId: string;
  themeId: string;
  customColors?: Partial<ThemeColors>;
  customFonts?: Partial<ThemeFonts>;
  customSpacing?: Partial<ThemeSpacing>;
  updatedAt: string;
}
