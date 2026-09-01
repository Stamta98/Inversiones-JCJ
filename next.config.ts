import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // Keeps the mobile (Capacitor) shell and the desktop build on identical output.
  poweredByHeader: false,
  experimental: {
    typedRoutes: false,
  },
};

export default config;
