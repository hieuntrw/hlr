import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "HLR Running Club",
  description: "Running club management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body className="bg-gray-50">
        <div className="flex h-screen">
          {/* Navigation Sidebar (Desktop) / Bottom Bar (Mobile) */}
          <Navigation />

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col overflow-hidden">
            {/* Content Container */}
            <div className="flex-1 overflow-y-auto pb-20 md:pb-0">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
