import type { Metadata, Viewport } from "next";

import { es } from "@/i18n/es";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: es.common.appName,
    template: `%s · ${es.common.appName}`,
  },
  description: es.common.tagline,
  applicationName: es.common.appName,
  appleWebApp: {
    capable: true,
    title: es.common.appName,
    statusBarStyle: "default",
  },
  manifest: "/manifest.webmanifest",
  icons: {
    // iOS ignores the manifest and reads this one for the home screen icon.
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The app is a data tool; letting it zoom out breaks the money columns.
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1d2126" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
