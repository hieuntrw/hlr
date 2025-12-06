Project media storage

Place project media files under `public/media` with the following recommended structure and filenames:

- `public/media/logo/logo.svg` - Full logo (desktop)
- `public/media/logo/logo-compact.svg` - Compact logo (mobile / favicon source)
- `public/media/avatars/` - User avatars (store filenames or use Supabase storage; keep originals or 256x256)
 - `public/media/avatars/avatar-placeholder.svg` - Default fallback avatar for users without uploaded avatars
- `public/media/banners/` - Page/banner images (recommended widths: 1200px+)
- `public/media/receipts/` - Receipts or uploaded images for finance records

Guidelines:
- Preferred formats: SVG for logos, WebP/PNG/JPEG for photos
- Use `logo-compact.svg` or generated PNG for favicon if needed
- When replacing logos, keep filenames the same to avoid code changes

Logo vs Avatar (Guidelines):
- **Logo**: Brand assets belonging to the project. Stored under `public/media/logo/`. Use `logo.svg` / `logo-compact.svg`. These are rectangular/square brand marks and used in headers, footers, and admin panels.
- **Avatar**: Personal images uploaded by members. Store under `public/media/avatars/` or host in Supabase Storage and set `profile.avatar_url` to the storage URL. Avatars are always shown as rounded circles, smaller than the logo, with a subtle border.
- **Security**: Treat uploaded avatars as user content — sanitize filenames, validate image types on upload, and prefer serving from a storage bucket with proper access rules.

If you want, I can add a script to upload these assets to Supabase Storage or S3 and map `profile.avatar_url` to storage URLs.
