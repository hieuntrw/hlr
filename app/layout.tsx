import type { Metadata } from "next";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
