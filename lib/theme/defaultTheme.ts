import { Theme } from './types';

/**
 * Default Theme Configuration - HLR Running Club
 * Màu chủ đạo: Orange (#F97316)
 */
export const defaultTheme: Theme = {
  id: 'hlr-default',
  name: 'HLR Default Theme',
  isDefault: true,
  
  colors: {
    // Primary - Orange
    primary: '#F97316',      // orange-600
    primaryDark: '#EA580C',  // orange-700
    primaryLight: '#FB923C', // orange-500
    
    // Accent - Orange variants
    accent: '#FDBA74',       // orange-300
    accentDark: '#F59E0B',   // amber-500
    accentLight: '#FED7AA',  // orange-200
    
    // Backgrounds
    bgPrimary: '#FFFFFF',
    bgSecondary: '#FFF7ED',  // orange-50
    bgTertiary: '#FFEDD5',   // orange-100
    
    // Text
    textPrimary: '#111827',   // gray-900
    textSecondary: '#4B5563', // gray-600
    textMuted: '#9CA3AF',     // gray-400
    textInverse: '#FFFFFF',
    
    // Status
    success: '#10B981',  // green-500
    warning: '#F59E0B',  // amber-500
    error: '#EF4444',    // red-500
    info: '#3B82F6',     // blue-500
    
    // Borders
    border: '#E5E7EB',      // gray-200
    borderLight: '#F3F4F6', // gray-100
    borderDark: '#D1D5DB',  // gray-300
  },
  
  fonts: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontFamilyHeading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontFamilyMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    
    fontSize: {
      xs: '0.75rem',    // 12px
      sm: '0.875rem',   // 14px
      base: '1rem',     // 16px
      lg: '1.125rem',   // 18px
      xl: '1.25rem',    // 20px
      '2xl': '1.5rem',  // 24px
      '3xl': '1.875rem',// 30px
      '4xl': '2.25rem', // 36px
      '5xl': '3rem',    // 48px
    },
    
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.75,
    },
  },
  
  spacing: {
    space: {
      xs: '0.25rem',  // 4px
      sm: '0.5rem',   // 8px
      md: '1rem',     // 16px
      lg: '1.5rem',   // 24px
      xl: '2rem',     // 32px
      '2xl': '3rem',  // 48px
      '3xl': '4rem',  // 64px
    },
    
    radius: {
      sm: '0.25rem',  // 4px
      md: '0.5rem',   // 8px
      lg: '0.75rem',  // 12px
      xl: '1rem',     // 16px
      full: '9999px',
    },
    
    shadow: {
      sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
      md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
      lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
    },
  },
};

/**
 * Alternative themes for future use
 */
export const blueTheme: Theme = {
  id: 'hlr-blue',
  name: 'HLR Blue Theme',
  isDefault: false,
  
  colors: {
    ...defaultTheme.colors,
    primary: '#3B82F6',      // blue-600
    primaryDark: '#2563EB',  // blue-700
    primaryLight: '#60A5FA', // blue-500
    
    accent: '#93C5FD',       // blue-300
    accentDark: '#1D4ED8',   // blue-700
    accentLight: '#BFDBFE',  // blue-200
    
    bgSecondary: '#EFF6FF',  // blue-50
    bgTertiary: '#DBEAFE',   // blue-100
  },
  
  fonts: defaultTheme.fonts,
  spacing: defaultTheme.spacing,
};

export const greenTheme: Theme = {
  id: 'hlr-green',
  name: 'HLR Green Theme',
  isDefault: false,
  
  colors: {
    ...defaultTheme.colors,
    primary: '#10B981',      // green-600
    primaryDark: '#059669',  // green-700
    primaryLight: '#34D399', // green-500
    
    accent: '#6EE7B7',       // green-300
    accentDark: '#047857',   // green-700
    accentLight: '#A7F3D0',  // green-200
    
    bgSecondary: '#ECFDF5',  // green-50
    bgTertiary: '#D1FAE5',   // green-100
  },
  
  fonts: defaultTheme.fonts,
  spacing: defaultTheme.spacing,
};
