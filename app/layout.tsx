import type { Metadata } from "next";
import "./globals.css";

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
      <body className="bg-gray-50">{children}</body>
    </html>
  );
}
