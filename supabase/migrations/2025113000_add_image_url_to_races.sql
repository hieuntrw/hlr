-- Add image_url column to races for banner support
ALTER TABLE races ADD COLUMN IF NOT EXISTS image_url TEXT;