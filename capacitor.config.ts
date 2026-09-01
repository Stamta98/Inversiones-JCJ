import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the very same Next.js app as a native Android (and iOS)
 * shell, so there is one codebase and one deployment.
 *
 * The app is data driven and needs the server anyway, so the shell points at
 * the deployed URL instead of bundling a stale copy of the front end. Set
 * MOBILE_SERVER_URL before running `npm run mobile:sync`.
 *
 * Build an APK:
 *   1. npx cap add android          (only the first time)
 *   2. MOBILE_SERVER_URL=https://tu-dominio.com npm run mobile:sync
 *   3. npm run mobile:apk           -> android/app/build/outputs/apk/release
 */
const serverUrl = process.env.MOBILE_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.inversionesjcj.app",
  appName: "Inversiones JCJ",
  webDir: "public",
  android: {
    allowMixedContent: false,
  },
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: serverUrl.startsWith("http://"),
      }
    : undefined,
};

export default config;
