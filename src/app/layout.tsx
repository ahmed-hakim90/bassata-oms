import type { Metadata, Viewport } from "next";
import { Cairo, Geist_Mono } from "next/font/google";
import {
  APP_DESCRIPTION_AR,
  APP_NAME,
  APP_TAGLINE_AR,
  APP_THEME_COLOR,
  APP_THEME_COLOR_DARK,
} from "@/lib/constants";
import { getSiteUrl } from "@/lib/site-url";
import { AppFooter } from "@/components/layout/app-footer";
import { AppProviders } from "@/components/providers/app-providers";
import "./globals.css";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["latin", "arabic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = getSiteUrl();

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: APP_THEME_COLOR },
    { media: "(prefers-color-scheme: dark)", color: APP_THEME_COLOR_DARK },
  ],
  colorScheme: "light dark",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE_AR}`,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION_AR,
  applicationName: APP_NAME,
  authors: [{ name: "Hakimo" }],
  creator: "Hakimo",
  publisher: APP_NAME,
  keywords: [
    APP_NAME,
    "كاشير",
    "نقطة بيع",
    "POS",
    "ERP",
    "إدارة فروع",
    "مخزون",
    "مبيعات",
    "مقهى",
    "مطعم",
  ],
  category: "business",
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    type: "website",
    locale: "ar_EG",
    url: siteUrl,
    siteName: APP_NAME,
    title: `${APP_NAME} — ${APP_TAGLINE_AR}`,
    description: APP_DESCRIPTION_AR,
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — ${APP_TAGLINE_AR}`,
    description: APP_DESCRIPTION_AR,
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: "default",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      suppressHydrationWarning
      className={`${cairo.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AppProviders>
          <div className="flex min-h-screen flex-col">
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            <AppFooter />
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
