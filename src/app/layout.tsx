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
    // Un solo color: la app es siempre clara, así que la barra del sistema
    // no debe seguir al teléfono.
    { color: "#ffffff" },
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
