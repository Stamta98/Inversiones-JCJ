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
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
