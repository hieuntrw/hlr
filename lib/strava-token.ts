import { createClient } from "@supabase/supabase-js";
import { refreshStravaToken } from "./strava-oauth";
import serverDebug from "@/lib/server-debug";

// Create server-side Supabase client with service role key
const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

/**
 * Get valid Strava access token for a user
 * Automatically refreshes if expired
 * 
 * @param userId - User ID from Supabase auth
 * @returns Valid access token or null if user has no Strava connection
 */
export async function getValidStravaToken(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  
  // Get user's Strava credentials (use maybeSingle to avoid coercion errors)
  const getProfileRes = await supabase
    .from("profiles")
    .select("id, strava_access_token, strava_refresh_token, strava_token_expires_at")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  const profile = getProfileRes.data ?? null;
  const profileError = getProfileRes.error ?? null;

  if (profileError) {
    serverDebug.error("[Strava Token] Profile query error:", profileError);
    return null;
  }

  if (!profile) {
    serverDebug.error("[Strava Token] No profile found for user:", userId);
    return null;
  }

  if (!profile.strava_access_token || !profile.strava_refresh_token) {
    serverDebug.debug("[Strava Token] User has no Strava connection", { userId, hasAccess: !!profile.strava_access_token, hasRefresh: !!profile.strava_refresh_token });
    return null;
  }

  // Check if token is still valid
  const expiresVal = Number(profile.strava_token_expires_at) || 0;
  const tokenExpiresAt = new Date(expiresVal > 0 ? expiresVal * 1000 : 0);
  const now = new Date();
  const bufferMinutes = 5; // Refresh if token expires in less than 5 minutes
  const expiryWithBuffer = new Date(tokenExpiresAt.getTime() - bufferMinutes * 60 * 1000);

  if (now < expiryWithBuffer) {
    serverDebug.debug("[Strava Token] Token is still valid until:", tokenExpiresAt);
    return profile.strava_access_token;
  }

  // Token expired or about to expire, refresh it
  serverDebug.debug("[Strava Token] Token expired or expiring soon, refreshing...");
  
  try {
    const tokenData = await refreshStravaToken(profile.strava_refresh_token);

    if (!tokenData || !tokenData.access_token) {
      serverDebug.error('[Strava Token] refresh returned no token data', { userId, tokenData });
      return null;
    }

    // Update profile with new tokens
    const supabaseForUpdate = getSupabaseAdmin();
    const { error: updateError } = await supabaseForUpdate
      .from("profiles")
      .update({
        strava_access_token: tokenData.access_token,
        strava_refresh_token: tokenData.refresh_token,
        strava_token_expires_at: tokenData.expires_at,
      })
      .eq("id", userId);

    if (updateError) {
      serverDebug.error("[Strava Token] Failed to update tokens:", updateError);
      return null;
    }

    serverDebug.debug("[Strava Token] Token refreshed successfully, new expiry:", new Date(tokenData.expires_at * 1000));
    return tokenData.access_token;
  } catch (error) {
    serverDebug.error("[Strava Token] Failed to refresh token:", error);
    return null;
  }
}

/**
 * Check if user has Strava connected and token is valid
 * 
 * @param userId - User ID from Supabase auth
 * @returns Object with connection status and token validity
 */
export async function checkStravaConnection(userId: string): Promise<{
  connected: boolean;
  tokenValid: boolean;
  needsReauth: boolean;
}> {
  const supabase = getSupabaseAdmin();
  const { data: profileCheck } = await supabase
    .from("profiles")
    .select("strava_id, strava_access_token, strava_refresh_token, strava_token_expires_at")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();

  if (!profileCheck?.strava_id || !profileCheck?.strava_access_token) {
    return { connected: false, tokenValid: false, needsReauth: false };
  }

  // Try to get valid token (will auto-refresh if needed)
  const token = await getValidStravaToken(userId);
  
  if (!token) {
    // Refresh failed, user needs to re-authenticate
    return { connected: true, tokenValid: false, needsReauth: true };
  }

  return { connected: true, tokenValid: true, needsReauth: false };
}
