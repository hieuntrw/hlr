import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Get access token from cookie
  const accessToken = req.cookies.get('sb-access-token')?.value;
  
  // If no access token, redirect to login
  if (!accessToken) {
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  try {
    // Create Supabase client for server-side validation
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Verify the token by getting user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      const redirectUrl = new URL("/login", req.url);
      redirectUrl.searchParams.set("redirect", req.nextUrl.pathname);
      return NextResponse.redirect(redirectUrl);
    }

    // Check if the route is an admin route
    if (req.nextUrl.pathname.startsWith("/admin")) {
      // Get user's profile to check role
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (error || !profile) {
        console.error("Error fetching profile:", error);
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }

      // Define valid admin/mod roles
      const validRoles = ["admin", "mod_finance", "mod_challenge", "mod_member"];

      if (!validRoles.includes(profile.role)) {
        // User doesn't have admin/mod role, redirect to dashboard
        return NextResponse.redirect(new URL("/dashboard", req.url));
      }

      // Role-based access control for specific admin routes
      const path = req.nextUrl.pathname;

      // Finance routes - only admin and mod_finance
      if (
        (path.startsWith("/admin/finance") || path === "/admin/finance-report") &&
        !["admin", "mod_finance"].includes(profile.role)
      ) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }

      // Challenge routes - only admin and mod_challenge
      if (path.startsWith("/admin/challenges") && !["admin", "mod_challenge"].includes(profile.role)) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }

      // Member and PB approval routes - only admin and mod_member
      if (
        (path.startsWith("/admin/members") || path.startsWith("/admin/pb-approval")) &&
        !["admin", "mod_member"].includes(profile.role)
      ) {
        return NextResponse.redirect(new URL("/admin", req.url));
      }

      // Settings route - only admin
      if (path.startsWith("/admin/settings") && profile.role !== "admin") {
        return NextResponse.redirect(new URL("/admin", req.url));
      }
    }

    return res;
  } catch (error) {
    console.error("Middleware error:", error);
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }
}

export const config = {
  matcher: [
    // Only protect admin routes with middleware
    "/admin/:path*",
  ],
};
