# HLR Running Club - AI Coding Agent Instructions

## Project Overview

**HLR Running Club** is a Next.js 14 + TypeScript web application that manages a running club with:
- **Strava OAuth integration** for automatic activity tracking
- **Challenge system** with monthly running goals (70-300 km targets)
- **Financial management** (fund collection, fines, transactions)
- **Race tracking** with PR detection and rewards system
- **Supabase backend** with PostgreSQL database and Row-Level Security (RLS)

## Architecture & Key Components

### 1. **Authentication & OAuth Flow**
- **OAuth Provider**: Strava (not built-in Supabase auth, uses custom implementation)
- **Flow**: User → `/api/auth/strava/login` → Strava consent → `/api/auth/strava/callback` → token storage
- **Token Storage**: Stored in `profiles` table (`strava_access_token`, `strava_refresh_token`, `strava_token_expires_at`)
- **Key Files**:
  - `lib/strava-oauth.ts` - OAuth utility functions (getStravaAuthUrl, exchangeCodeForToken, refreshStravaToken)
  - `app/api/auth/strava/login/route.ts` - Initiates OAuth flow
  - `app/api/auth/strava/callback/route.ts` - Handles callback and token storage

**Critical Pattern**: Uses dynamic URL building based on `NODE_ENV` to determine protocol (https for prod, http for local).

### 2. **Database Architecture** (`supabase/migrations/`)

#### Core Tables:
- **profiles** - User profiles with Strava credentials and personal bests (PBs)
- **challenges** - Monthly challenges (auto-created monthly, locked after 10 days)
- **challenge_participants** - Tracks participant progress (target_km, actual_km from Strava sync)
- **races** - Race events (date, location)
- **race_results** - Individual results (chip time, rank, PR flag)
- **transactions** - Financial tracking (collection, fines, donations, expenses, rewards)
- **reward_definitions** - Milestones and podium criteria
- **member_rewards** - Reward distribution tracking
- **pb_history** - Personal best history
- **system_settings** - Configurable values (monthly_fund_fee: 50,000 VND, challenge_fine_fee: 100,000 VND)

#### Data Flow:
1. User connects Strava → tokens stored in `profiles`
2. Edge function syncs Strava activities → updates `challenge_participants` (actual_km, avg_pace_seconds, total_activities)
3. Race results entered → `race_results` created, PBs updated in `profiles`
4. Reward engine evaluates milestones/podiums → `member_rewards` created, `transactions` recorded

### 3. **Row Level Security (RLS) Model**
- **profiles**: Users read/update own only
- **challenges**: Public read, admin-only write
- **challenge_participants**: Users see own participations, admins see all
- **race_results**: Users see own + public, admins manage all
- **transactions**: Users see own, admins see all
- **system_settings**: Public read-only
- **reward_definitions**: Public read-only

**Pattern**: All RLS checks use `auth.uid() = id` for own-data access or verify `role = 'admin'` in profiles table.

### 4. **External Integrations**
- **Strava API** (v3):
  - `POST https://www.strava.com/oauth/authorize` - Login
  - `POST https://www.strava.com/api/v3/oauth/token` - Token exchange/refresh
  - Scopes: `activity:read_all`
- **Supabase Edge Functions** (planned): `strava-sync` function to fetch activities on schedule
- **Environment Variables**: See `.env.local` for required secrets

## Development Workflow

### Starting the Development Server
```bash
npm run dev
```
Runs on `http://localhost:3000`. Redirect URI for Strava must match.

### Building for Production
```bash
npm run build
npm start
```
Uses `https` protocol for redirect URI based on `NODE_ENV=production`.

### Environment Setup
Copy and complete `.env.local` with:
- Supabase credentials (URL, anon key, service role key)
- Strava credentials (client ID, client secret)
- Base URL and redirect URI (auto-built in code, but documented for reference)

## Project-Specific Conventions

### 1. **Dynamic Redirect URI Construction**
Always build redirect URIs using the pattern in `lib/strava-oauth.ts` and callback routes:
```typescript
const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
const host = request.headers.get("host") || "localhost:3000";
const redirectUri = `${protocol}://${host}/api/auth/strava/callback`;
```
Never hardcode URLs - this ensures localhost dev and production both work.

### 2. **Error Handling in OAuth Routes**
Routes like `/api/auth/strava/callback` catch errors and redirect back to home with `?error=` query params instead of throwing. Follow this pattern for user-facing OAuth operations.

### 3. **Token Management Pattern**
When fetching Strava data, check token expiry before API calls. The `refreshStravaToken` function is available but currently manual - future edge functions should call it automatically.

### 4. **Supabase Client Usage**
Always import from `lib/supabase-client.ts` which validates environment variables at module load time. This throws early if config is missing.

### 5. **Naming Conventions**
- Snake_case for database columns (`strava_id`, `strava_access_token`, `actual_km`)
- camelCase for TypeScript variables and function names
- Vietnamese comments in migrations for clarity (existing pattern) - preserve this for context

### 6. **RLS Policies**
Always verify RLS policies are in place before querying tables from client. Test with both authenticated and public contexts.

## Common Tasks & Patterns

### Adding a New Feature Requiring Strava Data
1. Add column to `challenge_participants` or relevant table
2. Update edge function `strava-sync` to populate it
3. Add RLS policy allowing users to read their data
4. Frontend: Query via Supabase client with proper error handling

### Creating a New API Route
Use `export const dynamic = "force-dynamic";` in callback/auth routes to prevent caching. Example: `app/api/auth/strava/callback/route.ts`

### Handling User Authentication State
Currently uses implicit Supabase auth (`supabase.auth.getUser()`). Check `/app/dashboard/page.tsx` for usage patterns.

## Key Files Reference

| File | Purpose |
|------|---------|
| `lib/strava-oauth.ts` | Strava OAuth utilities |
| `lib/supabase-client.ts` | Supabase client initialization |
| `app/api/auth/strava/login/route.ts` | OAuth login initiator |
| `app/api/auth/strava/callback/route.ts` | OAuth token handler |
| `supabase/migrations/20251129032756_initial_hlr_schema.sql` | Core schema |
| `supabase/migrations/20251129033549_add_rls_policies.sql` | RLS policies |

## Dependencies
- **next@14.0.0** - Framework
- **@supabase/supabase-js@2.39.0** - DB & auth client
- **axios@1.6.0** - HTTP client (for potential Strava API calls)
- **react@18.2.0, react-dom@18.2.0** - UI library
- **TypeScript@5.3.0** - Type safety

## Known Limitations & TODOs
- Strava token refresh currently manual - automate via edge function or cron
- Dashboard page layout incomplete
- Challenge auto-creation (25th monthly) not yet implemented
- Edge function `strava-sync` not yet deployed
