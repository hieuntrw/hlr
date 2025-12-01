import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(req: NextRequest) {
  console.log("\n[Middleware] ===== NEW REQUEST =====");
  console.log("[Middleware] Path:", req.nextUrl.pathname);
  const allCookies = req.cookies.getAll();
  console.log("[Middleware] All cookies count:", allCookies.length);
  
  // Find Supabase auth cookies
  const authCookies = allCookies.filter(c => 
    c.name.includes('supabase') || 
    c.name.includes('sb-') ||
    c.name === 'sb-access-token' ||
    c.name === 'sb-refresh-token'
  );
  console.log("[Middleware] Auth cookies found:", authCookies.map(c => c.name).join(", "));
  
  let response = NextResponse.next({
    request: {
      headers: req.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const value = req.cookies.get(name)?.value;
          if (value) {
            console.log(`[Middleware] Cookie get: ${name} = ${value.substring(0, 20)}...`);
          }
          return value;
        },
        set(name: string, value: string, options: any) {
          console.log(`[Middleware] Cookie set: ${name}`);
          req.cookies.set({
            name,
            value,
            ...options,
          });
          response.cookies.set({
            name,
            value,
            ...options,
          });
        },
        remove(name: string, options: any) {
          console.log(`[Middleware] Cookie remove: ${name}`);
          req.cookies.set({
            name,
            value: "",
            ...options,
          });
          response.cookies.set({
            name,
            value: "",
            ...options,
          });
        },
      },
    }
  );

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  
  if (authError) {
    console.log("[Middleware] Auth error:", authError.message);
  }
  console.log("[Middleware] User:", user?.email || "not authenticated");
  console.log("[Middleware] User metadata:", user?.user_metadata);

  if (!user) {
    const redirectUrl = new URL("/login", req.url);
    redirectUrl.searchParams.set("redirect", req.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // Check if the route is an admin route
  if (req.nextUrl.pathname.startsWith("/admin")) {
    // Use Supabase Auth user metadata for role only
    const role = (user as any)?.user_metadata?.role as string | undefined;
    console.log("[Middleware] User role (metadata):", role);
    const validRoles = ["admin", "mod_finance", "mod_challenge", "mod_member"];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    // Role-based access control for specific admin routes
    const path = req.nextUrl.pathname;
    if (
      (path.startsWith("/admin/finance") || path === "/admin/finance-report") &&
      !["admin", "mod_finance"].includes(role)
    ) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    if (path.startsWith("/admin/challenges") && !["admin", "mod_challenge"].includes(role)) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    if (
      (path.startsWith("/admin/members") || path.startsWith("/admin/pb-approval")) &&
      !["admin", "mod_member"].includes(role)
    ) {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
    if (path.startsWith("/admin/settings") && role !== "admin") {
      return NextResponse.redirect(new URL("/admin", req.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Only protect admin routes with middleware
    "/admin/:path*",
  ],
};
