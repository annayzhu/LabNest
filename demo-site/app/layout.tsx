import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabNest Demo",
  description:
    "A public, synthetic-data demonstration of the LabNest research workflow.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
