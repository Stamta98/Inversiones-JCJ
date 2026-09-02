import type { MetadataRoute } from "next";

import { es } from "@/i18n/es";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: es.common.appName,
    short_name: "JCJ",
    description: es.common.tagline,
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    lang: "es",
    // PNGs at the two sizes Android asks for, because a phone that cannot
    // find a 512 icon offers to add a browser shortcut instead of installing
    // the app. The SVG stays for anything that can scale it.
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
