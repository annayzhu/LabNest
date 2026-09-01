import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { I18nProvider } from "@/components/I18nProvider";
import { MobileBackGestureGuard } from "@/components/MobileBackGestureGuard";
import { TypographyBoot } from "@/components/TypographyBoot";
import { localeCookieName, resolveAppLocale } from "@/lib/i18n";
import { typographyCssProperties, typographyCssStorageKey } from "@/lib/typography-settings";
import "./globals.css";

const typographyBootstrapScript = `(function(){try{var v=JSON.parse(localStorage.getItem(${JSON.stringify(typographyCssStorageKey)})||'{}');${JSON.stringify(typographyCssProperties)}.forEach(function(k){if(typeof v[k]==='string'&&v[k].length<500)document.documentElement.style.setProperty(k,v[k])})}catch(e){}})()`;

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
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('labnest.system-theme');if(t)document.documentElement.dataset.labnestTheme=t}catch(e){}})()` }} />
        <script dangerouslySetInnerHTML={{ __html: typographyBootstrapScript }} />
      </head>
      <body className="overflow-x-hidden">
        <MobileBackGestureGuard />
        <TypographyBoot />
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
