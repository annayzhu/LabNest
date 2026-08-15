import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { I18nProvider } from "@/components/I18nProvider";
import { MobileBackGestureGuard } from "@/components/MobileBackGestureGuard";
import { localeCookieName, resolveAppLocale } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "LabNest",
  description: "Your personal nest for protocols, notes, samples, and results.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = resolveAppLocale((await cookies()).get(localeCookieName)?.value);

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"} data-locale={locale} suppressHydrationWarning>
      <body className="overflow-x-hidden">
        <MobileBackGestureGuard />
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
