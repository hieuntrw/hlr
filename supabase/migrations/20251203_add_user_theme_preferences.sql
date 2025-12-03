-- Migration: Add user_theme_preferences table for personalized theme settings
-- Date: 2025-12-03
-- Description: Allow users to customize colors, fonts, and spacing

CREATE TABLE IF NOT EXISTS user_theme_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    theme_id TEXT NOT NULL DEFAULT 'hlr-default',
    
    -- Custom color overrides (JSONB for flexibility)
    custom_colors JSONB,
    
    -- Custom font settings (JSONB)
    custom_fonts JSONB,
    
    -- Custom spacing settings (JSONB)
    custom_spacing JSONB,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Ensure one preference per user
    UNIQUE(user_id)
);

-- Add RLS policies
ALTER TABLE user_theme_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own theme preferences" ON user_theme_preferences;
DROP POLICY IF EXISTS "Users can create own theme preferences" ON user_theme_preferences;
DROP POLICY IF EXISTS "Users can update own theme preferences" ON user_theme_preferences;
DROP POLICY IF EXISTS "Users can delete own theme preferences" ON user_theme_preferences;
DROP POLICY IF EXISTS "Admins can view all theme preferences" ON user_theme_preferences;

-- Users can read their own preferences
CREATE POLICY "Users can view own theme preferences"
    ON user_theme_preferences
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can create own theme preferences"
    ON user_theme_preferences
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own theme preferences"
    ON user_theme_preferences
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can delete their own preferences
CREATE POLICY "Users can delete own theme preferences"
    ON user_theme_preferences
    FOR DELETE
    USING (auth.uid() = user_id);

-- Admins can view all preferences
CREATE POLICY "Admins can view all theme preferences"
    ON user_theme_preferences
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_theme_preferences_user_id ON user_theme_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_theme_preferences_theme_id ON user_theme_preferences(theme_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_theme_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_user_theme_preferences_updated_at ON user_theme_preferences;
CREATE TRIGGER trigger_update_user_theme_preferences_updated_at
    BEFORE UPDATE ON user_theme_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_user_theme_preferences_updated_at();

-- Add comments
COMMENT ON TABLE user_theme_preferences IS 'Stores user-specific theme customizations for personalization';
COMMENT ON COLUMN user_theme_preferences.custom_colors IS 'JSONB storing color overrides matching ThemeColors interface';
COMMENT ON COLUMN user_theme_preferences.custom_fonts IS 'JSONB storing font overrides matching ThemeFonts interface';
COMMENT ON COLUMN user_theme_preferences.custom_spacing IS 'JSONB storing spacing overrides matching ThemeSpacing interface';

-- =============================================================================
-- PHASE 2: System-wide Theme Management & User Personalization
-- =============================================================================

-- Table: theme_presets
-- Stores predefined themes that users can choose from
CREATE TABLE IF NOT EXISTS theme_presets (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    preview_image_url TEXT,
    
    -- Theme configuration (JSONB)
    colors JSONB NOT NULL,
    fonts JSONB NOT NULL,
    spacing JSONB NOT NULL,
    
    -- Metadata
    is_system BOOLEAN DEFAULT false,  -- System themes (can't be deleted)
    is_active BOOLEAN DEFAULT true,   -- Available for selection
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Usage stats
    usage_count INTEGER DEFAULT 0
);

-- Add RLS for theme_presets
ALTER TABLE theme_presets ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view active theme presets" ON theme_presets;
DROP POLICY IF EXISTS "Admins can manage theme presets" ON theme_presets;
DROP POLICY IF EXISTS "Users can create custom theme presets" ON theme_presets;
DROP POLICY IF EXISTS "Users can update own theme presets" ON theme_presets;

-- Everyone can read active themes
CREATE POLICY "Anyone can view active theme presets"
    ON theme_presets
    FOR SELECT
    USING (is_active = true);

-- Admins can manage all themes
CREATE POLICY "Admins can manage theme presets"
    ON theme_presets
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Users can create custom themes
CREATE POLICY "Users can create custom theme presets"
    ON theme_presets
    FOR INSERT
    WITH CHECK (
        auth.uid() = created_by 
        AND is_system = false
    );

-- Users can update their own custom themes
CREATE POLICY "Users can update own theme presets"
    ON theme_presets
    FOR UPDATE
    USING (
        auth.uid() = created_by 
        AND is_system = false
    );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_theme_presets_active ON theme_presets(is_active);
CREATE INDEX IF NOT EXISTS idx_theme_presets_system ON theme_presets(is_system);
CREATE INDEX IF NOT EXISTS idx_theme_presets_created_by ON theme_presets(created_by);
CREATE INDEX IF NOT EXISTS idx_theme_presets_usage ON theme_presets(usage_count DESC);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_theme_presets_updated_at ON theme_presets;
CREATE TRIGGER trigger_update_theme_presets_updated_at
    BEFORE UPDATE ON theme_presets
    FOR EACH ROW
    EXECUTE FUNCTION update_user_theme_preferences_updated_at();

-- Table: system_theme_settings
-- Global theme configuration for the entire system
CREATE TABLE IF NOT EXISTS system_theme_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    
    -- Default theme for all users
    default_theme_id TEXT REFERENCES theme_presets(id),
    
    -- Dark mode settings
    dark_mode_enabled BOOLEAN DEFAULT true,
    dark_mode_auto_switch BOOLEAN DEFAULT false,  -- Auto switch based on time
    dark_mode_start_time TIME DEFAULT '18:00:00',
    dark_mode_end_time TIME DEFAULT '06:00:00',
    
    -- User customization permissions
    allow_user_themes BOOLEAN DEFAULT true,
    allow_user_dark_mode BOOLEAN DEFAULT true,
    allow_user_font_size BOOLEAN DEFAULT true,
    
    -- Accessibility
    high_contrast_mode BOOLEAN DEFAULT false,
    large_text_mode BOOLEAN DEFAULT false,
    
    -- Metadata
    updated_by UUID REFERENCES profiles(id),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Only one row allowed (id must always be 1)
    CONSTRAINT single_row_only CHECK (id = 1)
);

-- Add RLS
ALTER TABLE system_theme_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view system theme settings" ON system_theme_settings;
DROP POLICY IF EXISTS "Admins can update system theme settings" ON system_theme_settings;

-- Everyone can read system settings
CREATE POLICY "Anyone can view system theme settings"
    ON system_theme_settings
    FOR SELECT
    USING (true);

-- Only admins can update
CREATE POLICY "Admins can update system theme settings"
    ON system_theme_settings
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Add dark_mode column to user_theme_preferences
ALTER TABLE user_theme_preferences 
ADD COLUMN IF NOT EXISTS dark_mode_enabled BOOLEAN DEFAULT false;

ALTER TABLE user_theme_preferences
ADD COLUMN IF NOT EXISTS use_system_theme BOOLEAN DEFAULT true;

-- Insert default theme presets
INSERT INTO theme_presets (id, name, description, is_system, colors, fonts, spacing) VALUES
(
    'hlr-default',
    'HLR Orange (Default)',
    'Màu cam chủ đạo của HLR Running Club',
    true,
    '{
        "primary": "#F97316",
        "primaryDark": "#EA580C",
        "primaryLight": "#FB923C",
        "accent": "#FDBA74",
        "accentDark": "#F59E0B",
        "accentLight": "#FED7AA",
        "bgPrimary": "#FFFFFF",
        "bgSecondary": "#FFF7ED",
        "bgTertiary": "#FFEDD5",
        "textPrimary": "#111827",
        "textSecondary": "#4B5563",
        "textMuted": "#9CA3AF",
        "textInverse": "#FFFFFF",
        "success": "#10B981",
        "warning": "#F59E0B",
        "error": "#EF4444",
        "info": "#3B82F6",
        "border": "#E5E7EB",
        "borderLight": "#F3F4F6",
        "borderDark": "#D1D5DB"
    }'::jsonb,
    '{
        "fontFamily": "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif",
        "fontFamilyHeading": "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif",
        "fontFamilyMono": "ui-monospace, SFMono-Regular, Monaco, Consolas, monospace",
        "fontSize": {
            "xs": "0.75rem",
            "sm": "0.875rem",
            "base": "1rem",
            "lg": "1.125rem",
            "xl": "1.25rem",
            "2xl": "1.5rem",
            "3xl": "1.875rem",
            "4xl": "2.25rem",
            "5xl": "3rem"
        },
        "fontWeight": {
            "normal": 400,
            "medium": 500,
            "semibold": 600,
            "bold": 700
        },
        "lineHeight": {
            "tight": 1.25,
            "normal": 1.5,
            "relaxed": 1.75
        }
    }'::jsonb,
    '{
        "space": {
            "xs": "0.25rem",
            "sm": "0.5rem",
            "md": "1rem",
            "lg": "1.5rem",
            "xl": "2rem",
            "2xl": "3rem",
            "3xl": "4rem"
        },
        "radius": {
            "sm": "0.25rem",
            "md": "0.5rem",
            "lg": "0.75rem",
            "xl": "1rem",
            "full": "9999px"
        },
        "shadow": {
            "sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            "md": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            "lg": "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            "xl": "0 20px 25px -5px rgb(0 0 0 / 0.1)"
        }
    }'::jsonb
),
(
    'hlr-blue',
    'HLR Blue',
    'Theme màu xanh dương',
    true,
    '{
        "primary": "#3B82F6",
        "primaryDark": "#2563EB",
        "primaryLight": "#60A5FA",
        "accent": "#93C5FD",
        "accentDark": "#1D4ED8",
        "accentLight": "#BFDBFE",
        "bgPrimary": "#FFFFFF",
        "bgSecondary": "#EFF6FF",
        "bgTertiary": "#DBEAFE",
        "textPrimary": "#111827",
        "textSecondary": "#4B5563",
        "textMuted": "#9CA3AF",
        "textInverse": "#FFFFFF",
        "success": "#10B981",
        "warning": "#F59E0B",
        "error": "#EF4444",
        "info": "#3B82F6",
        "border": "#E5E7EB",
        "borderLight": "#F3F4F6",
        "borderDark": "#D1D5DB"
    }'::jsonb,
    '{
        "fontFamily": "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif",
        "fontFamilyHeading": "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif",
        "fontFamilyMono": "ui-monospace, SFMono-Regular, Monaco, Consolas, monospace",
        "fontSize": {
            "xs": "0.75rem",
            "sm": "0.875rem",
            "base": "1rem",
            "lg": "1.125rem",
            "xl": "1.25rem",
            "2xl": "1.5rem",
            "3xl": "1.875rem",
            "4xl": "2.25rem",
            "5xl": "3rem"
        },
        "fontWeight": {
            "normal": 400,
            "medium": 500,
            "semibold": 600,
            "bold": 700
        },
        "lineHeight": {
            "tight": 1.25,
            "normal": 1.5,
            "relaxed": 1.75
        }
    }'::jsonb,
    '{
        "space": {
            "xs": "0.25rem",
            "sm": "0.5rem",
            "md": "1rem",
            "lg": "1.5rem",
            "xl": "2rem",
            "2xl": "3rem",
            "3xl": "4rem"
        },
        "radius": {
            "sm": "0.25rem",
            "md": "0.5rem",
            "lg": "0.75rem",
            "xl": "1rem",
            "full": "9999px"
        },
        "shadow": {
            "sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            "md": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            "lg": "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            "xl": "0 20px 25px -5px rgb(0 0 0 / 0.1)"
        }
    }'::jsonb
),
(
    'hlr-green',
    'HLR Green',
    'Theme màu xanh lá',
    true,
    '{
        "primary": "#10B981",
        "primaryDark": "#059669",
        "primaryLight": "#34D399",
        "accent": "#6EE7B7",
        "accentDark": "#047857",
        "accentLight": "#A7F3D0",
        "bgPrimary": "#FFFFFF",
        "bgSecondary": "#ECFDF5",
        "bgTertiary": "#D1FAE5",
        "textPrimary": "#111827",
        "textSecondary": "#4B5563",
        "textMuted": "#9CA3AF",
        "textInverse": "#FFFFFF",
        "success": "#10B981",
        "warning": "#F59E0B",
        "error": "#EF4444",
        "info": "#3B82F6",
        "border": "#E5E7EB",
        "borderLight": "#F3F4F6",
        "borderDark": "#D1D5DB"
    }'::jsonb,
    '{
        "fontFamily": "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif",
        "fontFamilyHeading": "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif",
        "fontFamilyMono": "ui-monospace, SFMono-Regular, Monaco, Consolas, monospace",
        "fontSize": {
            "xs": "0.75rem",
            "sm": "0.875rem",
            "base": "1rem",
            "lg": "1.125rem",
            "xl": "1.25rem",
            "2xl": "1.5rem",
            "3xl": "1.875rem",
            "4xl": "2.25rem",
            "5xl": "3rem"
        },
        "fontWeight": {
            "normal": 400,
            "medium": 500,
            "semibold": 600,
            "bold": 700
        },
        "lineHeight": {
            "tight": 1.25,
            "normal": 1.5,
            "relaxed": 1.75
        }
    }'::jsonb,
    '{
        "space": {
            "xs": "0.25rem",
            "sm": "0.5rem",
            "md": "1rem",
            "lg": "1.5rem",
            "xl": "2rem",
            "2xl": "3rem",
            "3xl": "4rem"
        },
        "radius": {
            "sm": "0.25rem",
            "md": "0.5rem",
            "lg": "0.75rem",
            "xl": "1rem",
            "full": "9999px"
        },
        "shadow": {
            "sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            "md": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            "lg": "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            "xl": "0 20px 25px -5px rgb(0 0 0 / 0.1)"
        }
    }'::jsonb
),
(
    'hlr-dark',
    'HLR Dark Mode',
    'Theme tối cho ban đêm',
    true,
    '{
        "primary": "#F97316",
        "primaryDark": "#EA580C",
        "primaryLight": "#FB923C",
        "accent": "#FDBA74",
        "accentDark": "#F59E0B",
        "accentLight": "#FED7AA",
        "bgPrimary": "#1F2937",
        "bgSecondary": "#111827",
        "bgTertiary": "#374151",
        "textPrimary": "#F9FAFB",
        "textSecondary": "#D1D5DB",
        "textMuted": "#9CA3AF",
        "textInverse": "#111827",
        "success": "#10B981",
        "warning": "#F59E0B",
        "error": "#EF4444",
        "info": "#3B82F6",
        "border": "#374151",
        "borderLight": "#4B5563",
        "borderDark": "#1F2937"
    }'::jsonb,
    '{
        "fontFamily": "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif",
        "fontFamilyHeading": "-apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, sans-serif",
        "fontFamilyMono": "ui-monospace, SFMono-Regular, Monaco, Consolas, monospace",
        "fontSize": {
            "xs": "0.75rem",
            "sm": "0.875rem",
            "base": "1rem",
            "lg": "1.125rem",
            "xl": "1.25rem",
            "2xl": "1.5rem",
            "3xl": "1.875rem",
            "4xl": "2.25rem",
            "5xl": "3rem"
        },
        "fontWeight": {
            "normal": 400,
            "medium": 500,
            "semibold": 600,
            "bold": 700
        },
        "lineHeight": {
            "tight": 1.25,
            "normal": 1.5,
            "relaxed": 1.75
        }
    }'::jsonb,
    '{
        "space": {
            "xs": "0.25rem",
            "sm": "0.5rem",
            "md": "1rem",
            "lg": "1.5rem",
            "xl": "2rem",
            "2xl": "3rem",
            "3xl": "4rem"
        },
        "radius": {
            "sm": "0.25rem",
            "md": "0.5rem",
            "lg": "0.75rem",
            "xl": "1rem",
            "full": "9999px"
        },
        "shadow": {
            "sm": "0 1px 2px 0 rgb(0 0 0 / 0.05)",
            "md": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
            "lg": "0 10px 15px -3px rgb(0 0 0 / 0.1)",
            "xl": "0 20px 25px -5px rgb(0 0 0 / 0.1)"
        }
    }'::jsonb
)
ON CONFLICT (id) DO NOTHING;
-- Insert default system settings AFTER theme_presets (FK dependency)
INSERT INTO system_theme_settings (
    id,
    default_theme_id,
    dark_mode_enabled,
    allow_user_themes,
    allow_user_dark_mode,
    allow_user_font_size
) VALUES (
    1,
    'hlr-default',
    true,
    true,
    true,
    true
) ON CONFLICT (id) DO NOTHING;


-- Comments
COMMENT ON TABLE theme_presets IS 'Predefined theme templates that users can select';
COMMENT ON TABLE system_theme_settings IS 'Global theme configuration and permissions';
COMMENT ON COLUMN user_theme_preferences.dark_mode_enabled IS 'User preference for dark mode';
COMMENT ON COLUMN user_theme_preferences.use_system_theme IS 'If true, use system default theme instead of custom';

-- =============================================================================
-- UTILITY FUNCTIONS
-- =============================================================================

-- Function to increment theme usage count
CREATE OR REPLACE FUNCTION increment_theme_usage(theme_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE theme_presets
    SET usage_count = usage_count + 1
    WHERE id = theme_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
