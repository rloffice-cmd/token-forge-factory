import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RMINT – מערכת ניהול קרן",
  description: "RMINT TCG Fund Operating System – Command Center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="antialiased">{children}</body>
    </html>
  );
}
