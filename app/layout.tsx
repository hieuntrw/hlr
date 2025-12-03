"use client";
import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth/AuthContext";
import Script from "next/script";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Load theme immediately before render to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // Load dark mode preference
                  const darkMode = localStorage.getItem('darkMode') === 'true';
                  if (darkMode) {
                    document.documentElement.classList.add('dark');
                  }
                  
                  // Load theme colors from localStorage
                  const savedTheme = localStorage.getItem('currentTheme');
                  if (savedTheme) {
                    const theme = JSON.parse(savedTheme);
                    const root = document.documentElement;
                    
                    // Mark that theme has been pre-loaded
                    root.setAttribute('data-theme-preloaded', 'true');
                    
                    // Apply colors with correct mapping
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
                        if (theme.colors[key]) {
                          root.style.setProperty(cssVar, theme.colors[key]);
                        }
                      });
                    }
                    
                    // Apply fonts
                    if (theme.fonts) {
                      if (theme.fonts.body) root.style.setProperty('--font-body', theme.fonts.body);
                      if (theme.fonts.heading) root.style.setProperty('--font-heading', theme.fonts.heading);
                    }
                  }
                } catch (e) {
                  console.error('Failed to load theme from localStorage:', e);
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
