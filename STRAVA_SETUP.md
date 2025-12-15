# Strava OAuth Integration Setup Guide

## Overview

This guide covers the Strava OAuth integration for the HLR Running Club application. The system includes:
- OAuth login flow that redirects users to Strava
- Secure token storage in Supabase profiles table
- Automatic token refresh mechanism
- Background sync of Strava activities to track running challenges

## Architecture

### 1. OAuth Flow

**Connect Route** (`/api/strava/connect/login`) - used to connect an existing Supabase account to Strava
- Generates Strava authorization URL
- Redirects user to Strava OAuth consent screen
- User grants permission for activity access

**Callback Route** (`/api/strava/connect/callback`)
- Receives authorization code from Strava
- Exchanges code for access/refresh tokens
- Stores tokens securely in profiles table
- Redirects to dashboard with success confirmation

### 2. Token Management

Tokens are stored in the `profiles` table:
- `strava_access_token` - Short-lived token for API requests
- `strava_refresh_token` - Long-lived token to get new access tokens
- `strava_token_expires_at` - Unix timestamp for expiry

The edge function automatically refreshes tokens when expired.

### 3. Activity Sync

**Supabase Edge Function** (`strava-sync`)
- Runs on a schedule (set up in Supabase dashboard)
- Fetches user's recent running activities from Strava API
- Calculates total KM and average pace for current challenge
- Updates `challenge_participants` table with:
  - `actual_km` - Total kilometers run
  - `avg_pace_seconds` - Average pace in seconds per km
  - `total_activities` - Number of runs
  - `last_synced_at` - Sync timestamp

## Setup Instructions

### Step 1: Create Strava Application

1. Go to [Strava Settings > My App](https://www.strava.com/settings/apps)
2. Click "Create New App"
3. Fill in:
   - Application Name: "HLR Running Club"
   - Category: Physical Activity
   - Website: Your domain
   - Application Description: Running challenge tracker
4. Accept terms and create
5. You'll receive:
   - **Client ID** (needed for .env)
   - **Client Secret** (needed for .env)

### Step 2: Configure Redirect URL

1. In Strava My App dashboard
2. Set Authorization Callback Domain to your domain
3. Examples:
   - Local: `http://localhost:3000`
   - Production: `https://yourdomain.com`

### Step 3: Environment Variables

Update `.env` with your Strava credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://jvnpxcwjfidrlqlfmuvl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>

STRAVA_CLIENT_ID=<your-client-id>
STRAVA_CLIENT_SECRET=<your-client-secret>
```

### Step 4: Configure Edge Function Secrets

In Supabase Dashboard:

1. Navigate to Edge Functions > strava-sync
2. Go to Settings > Secrets
3. Add:
   - `STRAVA_CLIENT_ID` = Your Client ID
   - `STRAVA_CLIENT_SECRET` = Your Client Secret

### Step 5: Schedule Sync Function

In Supabase Dashboard:

1. Go to Database > Webhooks (or Functions > Scheduled)
2. Create a scheduled task to call the sync function
3. Recommended: Every 6 hours to keep activities up-to-date
4. HTTP POST to: `https://YOUR_PROJECT_ID.supabase.co/functions/v1/strava-sync`
5. Add Authorization header with your service role key

Alternatively, call the function from your backend:

```typescript
const response = await fetch(
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/strava-sync`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  }
);
```

## User Flow

1. User clicks "Connect with Strava" button
2. Gets redirected to `/api/strava/connect/login`
3. Redirected to Strava OAuth page
4. User grants permission for activity access
5. Strava redirects to `/api/strava/connect/callback` with auth code
6. Token stored in database
7. User redirected to dashboard with success message
8. Next sync event pulls activities and updates challenge progress

## Database Schema

### Profiles Table Updates

When user connects Strava, these fields are populated:

```sql
strava_id TEXT UNIQUE              -- Strava athlete ID
strava_access_token TEXT           -- Active API token
strava_refresh_token TEXT          -- Refresh token
strava_token_expires_at BIGINT     -- Token expiry (Unix timestamp)
```

### Challenge Participants Table

Sync function updates:

```sql
actual_km NUMERIC(10, 2)           -- Total km run in challenge
avg_pace_seconds INTEGER           -- Average pace (seconds/km)
total_activities INTEGER           -- Number of activities
last_synced_at TIMESTAMPTZ         -- Last sync timestamp
```

## Error Handling

### Common Issues

**"STRAVA_CLIENT_ID not configured"**
- Ensure `.env` file has `STRAVA_CLIENT_ID` set
- For edge functions, add secrets in Supabase dashboard

**"Failed to get access token"**
- Check Client ID and Secret are correct
- Verify authorization URL matches Strava app settings

**"No active challenge found"**
- Create a challenge with dates that match current date
- Challenge `end_date` must be after today

**"User not registered for current challenge"**
- User must be registered in `challenge_participants`
- Manual registration may be needed for legacy members

## Testing

### Local Testing

```bash
npm run dev
# Visit http://localhost:3000
# Click "Connect with Strava"
# Should redirect to Strava OAuth page
# After authorization, should see dashboard success message
```

### Testing Edge Function

```bash
# Test sync endpoint
curl https://YOUR_PROJECT_ID.supabase.co/functions/v1/strava-sync \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
```

Expected response:

```json
{
  "processed": 3,
  "updated": 2,
  "errors": ["User not registered for current challenge"]
}
```

## Security

- Tokens are stored securely in Supabase
- Service role key never exposed to frontend
- Edge function validates user ownership before syncing
- Refresh tokens automatically used before expiry
- RLS policies ensure users only see their own data

## Troubleshooting

1. **Check Supabase logs** for edge function errors
2. **Verify profile exists** in Supabase profiles table after OAuth
3. **Check token timestamps** - may need refresh
4. **Verify challenge dates** - must include today
5. **Check Strava API status** at status.strava.com
