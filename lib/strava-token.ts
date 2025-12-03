import { createClient } from "@supabase/supabase-js";
import { refreshStravaToken } from "./strava-oauth";

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
  
  // Get user's Strava credentials
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("strava_access_token, strava_refresh_token, strava_token_expires_at")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    console.error("[Strava Token] No profile found:", profileError);
    return null;
  }

  if (!profile.strava_access_token || !profile.strava_refresh_token) {
    console.log("[Strava Token] User has no Strava connection");
    return null;
  }

  // Check if token is still valid
  const tokenExpiresAt = new Date(profile.strava_token_expires_at * 1000);
  const now = new Date();
  const bufferMinutes = 5; // Refresh if token expires in less than 5 minutes
  const expiryWithBuffer = new Date(tokenExpiresAt.getTime() - bufferMinutes * 60 * 1000);

  if (now < expiryWithBuffer) {
    console.log("[Strava Token] Token is still valid until:", tokenExpiresAt);
    return profile.strava_access_token;
  }

  // Token expired or about to expire, refresh it
  console.log("[Strava Token] Token expired or expiring soon, refreshing...");
  
  try {
    const tokenData = await refreshStravaToken(profile.strava_refresh_token);

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
      console.error("[Strava Token] Failed to update tokens:", updateError);
      return null;
    }

    console.log("[Strava Token] Token refreshed successfully, new expiry:", new Date(tokenData.expires_at * 1000));
    return tokenData.access_token;
  } catch (error) {
    console.error("[Strava Token] Failed to refresh token:", error);
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
  const { data: profile } = await supabase
    .from("profiles")
    .select("strava_id, strava_access_token, strava_refresh_token, strava_token_expires_at")
    .eq("id", userId)
    .single();

  if (!profile?.strava_id || !profile?.strava_access_token) {
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
