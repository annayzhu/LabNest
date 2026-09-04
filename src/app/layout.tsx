import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { I18nProvider } from "@/components/I18nProvider";
import { TypographyBoot } from "@/components/TypographyBoot";
import { localeCookieName, resolveAppLocale } from "@/lib/i18n";
import { systemThemeCssText, systemThemes, systemThemeStorageKey } from "@/lib/system-theme";
import { typographyCssProperties, typographyCssStorageKey } from "@/lib/typography-settings";
import { defaultUiScale, uiScaleOptions, uiScaleStorageKey } from "@/lib/ui-scale";
import "./globals.css";

const typographyBootstrapScript = `(function(){try{var v=JSON.parse(localStorage.getItem(${JSON.stringify(typographyCssStorageKey)})||'{}');${JSON.stringify(typographyCssProperties)}.forEach(function(k){if(typeof v[k]==='string'&&v[k].length<500)document.documentElement.style.setProperty(k,v[k])})}catch(e){}})()`;
const systemThemeStyles = systemThemeCssText();
const systemThemeBootstrapScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(systemThemeStorageKey)});if(${JSON.stringify(systemThemes.map((theme) => theme.id))}.includes(t))document.documentElement.dataset.labnestTheme=t}catch(e){}})()`;
const uiScaleBootstrapScript = `(function(){try{var s=localStorage.getItem(${JSON.stringify(uiScaleStorageKey)});document.documentElement.dataset.labnestUiScale=${JSON.stringify(uiScaleOptions.map((option) => option.id))}.includes(s)?s:${JSON.stringify(defaultUiScale)}}catch(e){}})()`;

export const metadata: Metadata = {
  title: "LabNest",
  description: "Your personal nest for protocols, notes, samples, and results.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = resolveAppLocale((await cookies()).get(localeCookieName)?.value);

  return (
    <html lang={locale === "zh" ? "zh-CN" : "en"} data-locale={locale} data-labnest-ui-scale={defaultUiScale} suppressHydrationWarning>
      <head>
        <style dangerouslySetInnerHTML={{ __html: systemThemeStyles }} />
        <script dangerouslySetInnerHTML={{ __html: systemThemeBootstrapScript }} />
        <script dangerouslySetInnerHTML={{ __html: typographyBootstrapScript }} />
        <script dangerouslySetInnerHTML={{ __html: uiScaleBootstrapScript }} />
      </head>
      <body className="overflow-x-hidden">
        <TypographyBoot />
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
