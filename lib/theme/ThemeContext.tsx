"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Theme, UserThemePreference } from './types';
import { defaultTheme } from './defaultTheme';
import { supabase } from '@/lib/supabase-client';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  applyCustomizations: (customizations: Partial<Theme>) => void;
  resetTheme: () => void;
  saveUserPreference: () => Promise<void>;
  loading: boolean;
  // Dark mode
  darkMode: boolean;
  toggleDarkMode: () => void;
  // System theme
  useSystemTheme: boolean;
  setUseSystemTheme: (use: boolean) => void;
  // Theme presets
  themePresets: Theme[];
  loadThemePresets: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// Initialize theme from localStorage immediately (SSR-safe)
const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return defaultTheme;
  
  try {
    const savedTheme = localStorage.getItem('currentTheme');
    if (savedTheme) {
      return JSON.parse(savedTheme);
    }
  } catch (e) {
    console.error('Failed to parse saved theme:', e);
  }
  return defaultTheme;
};

// Initialize dark mode from localStorage immediately (SSR-safe)
const getInitialDarkMode = (): boolean => {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem('darkMode') === 'true';
};

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [useSystemTheme, setUseSystemThemeState] = useState(true);
  const [themePresets, setThemePresets] = useState<Theme[]>([]);
  const [systemSettings, setSystemSettings] = useState<any>(null);

  // Load theme from database (for sync only, not for initial display)
  useEffect(() => {
    loadThemeFromDatabase();
    loadSystemSettings();
    loadThemePresetsData();
  }, []);

  // Apply theme to CSS variables whenever theme changes (skip if preloaded)
  useEffect(() => {
    // Check if theme was preloaded by inline script
    const isPreloaded = document.documentElement.getAttribute('data-theme-preloaded') === 'true';
    
    if (!isPreloaded) {
      // Only apply if not already preloaded
      applyThemeToDOM(theme);
    } else {
      // Clear the flag after first render
      document.documentElement.removeAttribute('data-theme-preloaded');
    }
    
    // Save to localStorage for instant load on next page
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentTheme', JSON.stringify(theme));
    }
  }, [theme]);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    // Save dark mode preference
    if (typeof window !== 'undefined') {
      localStorage.setItem('darkMode', darkMode.toString());
    }
  }, [darkMode]);

  const loadThemeFromDatabase = async () => {
    try {
      // Theme and dark mode are already initialized from localStorage
      // This function only syncs with database for updates
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserId(user.id);
        
        // Try to load user's theme preference from database
        const { data: preference, error } = await supabase
          .from('user_theme_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (preference && !error) {
          setUseSystemThemeState(preference.use_system_theme ?? true);
          
          let dbTheme = null;
          
          if (preference.use_system_theme) {
            // Load system default theme
            const { data: systemSettings } = await supabase
              .from('system_theme_settings')
              .select('default_theme_id')
              .single();
            
            if (systemSettings?.default_theme_id) {
              const { data: themePreset } = await supabase
                .from('theme_presets')
                .select('*')
                .eq('id', systemSettings.default_theme_id)
                .single();
              
              if (themePreset) {
                dbTheme = convertPresetToTheme(themePreset);
              }
            }
          } else {
            // Merge user customizations with base theme
            dbTheme = mergeThemeCustomizations(
              defaultTheme,
              preference.custom_colors,
              preference.custom_fonts,
              preference.custom_spacing
            );
          }
          
          // Compare with localStorage (not React state) to prevent unnecessary updates
          // This prevents flickering when DB theme matches localStorage but React state might be stale
          if (dbTheme) {
            const localStorageTheme = typeof window !== 'undefined' 
              ? localStorage.getItem('currentTheme') 
              : null;
            
            const localThemeColors = localStorageTheme 
              ? JSON.stringify(JSON.parse(localStorageTheme).colors)
              : null;
            
            const dbThemeColors = JSON.stringify(dbTheme.colors);
            
            // Only update if DB theme differs from localStorage
            if (localThemeColors !== dbThemeColors) {
              setThemeState(dbTheme);
            }
          }
          
          // Sync dark mode from database
          if (preference.dark_mode_enabled !== darkMode) {
            setDarkMode(preference.dark_mode_enabled || false);
          }
        }
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSystemSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('system_theme_settings')
        .select('*')
        .single();
      
      if (data && !error) {
        setSystemSettings(data);
      }
    } catch (error) {
      console.error('Error loading system settings:', error);
    }
  };

  const loadThemePresetsData = async () => {
    try {
      const { data, error } = await supabase
        .from('theme_presets')
        .select('*')
        .eq('is_active', true)
        .order('is_system', { ascending: false })
        .order('usage_count', { ascending: false });
      
      if (data && !error) {
        const themes = data.map(convertPresetToTheme);
        setThemePresets(themes);
      }
    } catch (error) {
      console.error('Error loading theme presets:', error);
    }
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    // localStorage save is handled by useEffect
  };

  const applyCustomizations = (customizations: Partial<Theme>) => {
    const customizedTheme: Theme = {
      ...theme,
      ...customizations,
      colors: { ...theme.colors, ...customizations.colors },
      fonts: { 
        ...theme.fonts, 
        ...customizations.fonts,
        fontSize: { ...theme.fonts.fontSize, ...customizations.fonts?.fontSize },
        fontWeight: { ...theme.fonts.fontWeight, ...customizations.fonts?.fontWeight },
        lineHeight: { ...theme.fonts.lineHeight, ...customizations.fonts?.lineHeight },
      },
      spacing: {
        ...theme.spacing,
        ...customizations.spacing,
        space: { ...theme.spacing.space, ...customizations.spacing?.space },
        radius: { ...theme.spacing.radius, ...customizations.spacing?.radius },
        shadow: { ...theme.spacing.shadow, ...customizations.spacing?.shadow },
      },
    };
    
    setTheme(customizedTheme);
  };

  const resetTheme = () => {
    setTheme(defaultTheme);
    localStorage.removeItem('currentTheme');
  };

  const saveUserPreference = async () => {
    if (!userId) {
      console.warn('Cannot save theme preference: User not logged in');
      return;
    }

    try {
      const preference: any = {
        user_id: userId,
        theme_id: theme.id,
        custom_colors: useSystemTheme ? null : theme.colors,
        custom_fonts: useSystemTheme ? null : theme.fonts,
        custom_spacing: useSystemTheme ? null : theme.spacing,
        dark_mode_enabled: darkMode,
        use_system_theme: useSystemTheme,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_theme_preferences')
        .upsert(preference, { onConflict: 'user_id' });

      if (error) {
        console.error('Error saving theme preference:', error);
        throw error;
      }
      
      // Update theme preset usage count
      if (theme.id && !useSystemTheme) {
        await supabase.rpc('increment_theme_usage', { theme_id: theme.id });
      }
    } catch (error) {
      console.error('Failed to save theme preference:', error);
      throw error;
    }
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const setUseSystemTheme = (use: boolean) => {
    setUseSystemThemeState(use);
    if (use) {
      // Reload system default theme
      loadThemeFromDatabase();
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        applyCustomizations,
        resetTheme,
        saveUserPreference,
        loading,
        darkMode,
        toggleDarkMode,
        useSystemTheme,
        setUseSystemTheme,
        themePresets,
        loadThemePresets: loadThemePresetsData,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Helper functions

function applyThemeToDOM(theme: Theme) {
  const root = document.documentElement;
  
  // Apply colors
  root.style.setProperty('--color-primary', theme.colors.primary);
  root.style.setProperty('--color-primary-dark', theme.colors.primaryDark);
  root.style.setProperty('--color-primary-light', theme.colors.primaryLight);
  
  root.style.setProperty('--color-accent', theme.colors.accent);
  root.style.setProperty('--color-accent-dark', theme.colors.accentDark);
  root.style.setProperty('--color-accent-light', theme.colors.accentLight);
  
  root.style.setProperty('--color-bg-primary', theme.colors.bgPrimary);
  root.style.setProperty('--color-bg-secondary', theme.colors.bgSecondary);
  root.style.setProperty('--color-bg-tertiary', theme.colors.bgTertiary);
  
  root.style.setProperty('--color-text-primary', theme.colors.textPrimary);
  root.style.setProperty('--color-text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--color-text-muted', theme.colors.textMuted);
  root.style.setProperty('--color-text-inverse', theme.colors.textInverse);
  
  root.style.setProperty('--color-success', theme.colors.success);
  root.style.setProperty('--color-warning', theme.colors.warning);
  root.style.setProperty('--color-error', theme.colors.error);
  root.style.setProperty('--color-info', theme.colors.info);
  
  root.style.setProperty('--color-border', theme.colors.border);
  root.style.setProperty('--color-border-light', theme.colors.borderLight);
  root.style.setProperty('--color-border-dark', theme.colors.borderDark);
  
  // Apply fonts
  root.style.setProperty('--font-family', theme.fonts.fontFamily);
  root.style.setProperty('--font-family-heading', theme.fonts.fontFamilyHeading);
  root.style.setProperty('--font-family-mono', theme.fonts.fontFamilyMono);
  
  root.style.setProperty('--font-size-xs', theme.fonts.fontSize.xs);
  root.style.setProperty('--font-size-sm', theme.fonts.fontSize.sm);
  root.style.setProperty('--font-size-base', theme.fonts.fontSize.base);
  root.style.setProperty('--font-size-lg', theme.fonts.fontSize.lg);
  root.style.setProperty('--font-size-xl', theme.fonts.fontSize.xl);
  root.style.setProperty('--font-size-2xl', theme.fonts.fontSize['2xl']);
  root.style.setProperty('--font-size-3xl', theme.fonts.fontSize['3xl']);
  root.style.setProperty('--font-size-4xl', theme.fonts.fontSize['4xl']);
  root.style.setProperty('--font-size-5xl', theme.fonts.fontSize['5xl']);
  
  root.style.setProperty('--font-weight-normal', theme.fonts.fontWeight.normal.toString());
  root.style.setProperty('--font-weight-medium', theme.fonts.fontWeight.medium.toString());
  root.style.setProperty('--font-weight-semibold', theme.fonts.fontWeight.semibold.toString());
  root.style.setProperty('--font-weight-bold', theme.fonts.fontWeight.bold.toString());
  
  // Apply spacing
  root.style.setProperty('--space-xs', theme.spacing.space.xs);
  root.style.setProperty('--space-sm', theme.spacing.space.sm);
  root.style.setProperty('--space-md', theme.spacing.space.md);
  root.style.setProperty('--space-lg', theme.spacing.space.lg);
  root.style.setProperty('--space-xl', theme.spacing.space.xl);
  root.style.setProperty('--space-2xl', theme.spacing.space['2xl']);
  root.style.setProperty('--space-3xl', theme.spacing.space['3xl']);
  
  root.style.setProperty('--radius-sm', theme.spacing.radius.sm);
  root.style.setProperty('--radius-md', theme.spacing.radius.md);
  root.style.setProperty('--radius-lg', theme.spacing.radius.lg);
  root.style.setProperty('--radius-xl', theme.spacing.radius.xl);
  root.style.setProperty('--radius-full', theme.spacing.radius.full);
  
  root.style.setProperty('--shadow-sm', theme.spacing.shadow.sm);
  root.style.setProperty('--shadow-md', theme.spacing.shadow.md);
  root.style.setProperty('--shadow-lg', theme.spacing.shadow.lg);
  root.style.setProperty('--shadow-xl', theme.spacing.shadow.xl);
}

function mergeThemeCustomizations(
  baseTheme: Theme,
  customColors?: any,
  customFonts?: any,
  customSpacing?: any
): Theme {
  return {
    ...baseTheme,
    colors: { ...baseTheme.colors, ...customColors },
    fonts: { 
      ...baseTheme.fonts, 
      ...customFonts,
      fontSize: { ...baseTheme.fonts.fontSize, ...customFonts?.fontSize },
      fontWeight: { ...baseTheme.fonts.fontWeight, ...customFonts?.fontWeight },
      lineHeight: { ...baseTheme.fonts.lineHeight, ...customFonts?.lineHeight },
    },
    spacing: {
      ...baseTheme.spacing,
      ...customSpacing,
      space: { ...baseTheme.spacing.space, ...customSpacing?.space },
      radius: { ...baseTheme.spacing.radius, ...customSpacing?.radius },
      shadow: { ...baseTheme.spacing.shadow, ...customSpacing?.shadow },
    },
  };
}

function convertPresetToTheme(preset: any): Theme {
  return {
    id: preset.id,
    name: preset.name,
    colors: preset.colors,
    fonts: preset.fonts,
    spacing: preset.spacing,
    isDefault: preset.is_system,
  };
}
