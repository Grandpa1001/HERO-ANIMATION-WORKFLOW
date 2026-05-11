import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hero Animation — Kokpit",
  description: "Pipeline animacji postaci: PNG → fal.ai → MP4 → GIF/WebP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
