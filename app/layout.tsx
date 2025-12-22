"use client";
// layout
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth/AuthContext";
// no next/script used here

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Load theme and cleanup malformed Supabase cookies immediately before render to prevent flash and cookie parse errors */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // --- Theme preload ---
                  const darkMode = localStorage.getItem('darkMode') === 'true';
                  if (darkMode) document.documentElement.classList.add('dark');
                  const savedTheme = localStorage.getItem('currentTheme');
                  if (savedTheme) {
                    try {
                      const theme = JSON.parse(savedTheme);
                      const root = document.documentElement;
                      root.setAttribute('data-theme-preloaded', 'true');
                      if (theme.colors) {
                        const colorMap = {
                          primary: '--color-primary',
                          primaryDark: '--color-primary-dark',
                          primaryLight: '--color-primary-light',
                          accent: '--color-accent',
                          accentDark: '--color-accent-dark',
                          accentLight: '--color-accent-light',
                          bgPrimary: '--color-bg-primary',
                          bgSecondary: '--color-bg-secondary',
                          bgTertiary: '--color-bg-tertiary',
                          textPrimary: '--color-text-primary',
                          textSecondary: '--color-text-secondary',
                          textMuted: '--color-text-muted',
                          textInverse: '--color-text-inverse',
                          success: '--color-success',
                          warning: '--color-warning',
                          error: '--color-error',
                          info: '--color-info',
                          border: '--color-border',
                          borderLight: '--color-border-light',
                          borderDark: '--color-border-dark'
                        };
                        Object.entries(colorMap).forEach(([key, cssVar]) => {
                          if (theme.colors[key]) root.style.setProperty(cssVar, theme.colors[key]);
                        });
                      }
                      if (theme.fonts) {
                        if (theme.fonts.body) root.style.setProperty('--font-body', theme.fonts.body);
                        if (theme.fonts.heading) root.style.setProperty('--font-heading', theme.fonts.heading);
                      }
                    } catch (e) {
                      console.error('Failed to parse saved theme:', e);
                    }
                  }

                  // --- Supabase cookie cleanup ---
                  // Some browser cookies (imported/tested) may contain non-JSON values like 'base64-...'
                  // which break Supabase's cookie parser. Remove obvious bad cookies early.
                  try {
                    const cookies = (document.cookie || '').split(';').map(c => c.trim()).filter(Boolean);
                    cookies.forEach(cookie => {
                      const eq = cookie.indexOf('=');
                      if (eq === -1) return;
                      const name = cookie.slice(0, eq);
                      const val = decodeURIComponent(cookie.slice(eq + 1) || '');
                      // If value looks like base64-prefixed token or is not valid JSON and cookie name contains 'supabase' or 'sb'
                      if ((val && val.startsWith('base64-')) || ((name.toLowerCase().includes('supabase') || name.toLowerCase().startsWith('sb')))) {
                        try {
                          JSON.parse(val);
                        } catch (e) {
                          // clear cookie
                          document.cookie = name + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
                          console.info('Cleared malformed auth cookie:', name);
                        }
                      }
                    });
                  } catch (e) {
                    // non-fatal
                  }
                } catch (e) {
                  console.error('Preload script failed:', e);
                }
              })();
            `,
          }}
        />
      </head>
      <body 
        className="bg-gray-50 min-h-screen flex flex-col"
        suppressHydrationWarning={true}
      >
        <AuthProvider>
          <ThemeProvider>
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
