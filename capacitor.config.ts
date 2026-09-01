import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor wraps the very same web app as a native Android and iOS shell, so
 * there is one codebase, one deployment and no second front end to maintain.
 *
 * The shell points at the deployed site instead of bundling a copy of it: this
 * is a data driven app that needs the server for every screen anyway, and a
 * bundled copy would go stale the moment the site is updated — a collector
 * would be looking at yesterday's app.
 *
 * `mobile/` is not the app: it is the local screen shown while the site loads
 * and, more importantly, when the phone loses signal mid-route.
 *
 * Android APK:
 *   npx cap add android                                    (only the first time)
 *   MOBILE_SERVER_URL=https://tu-dominio.com npm run mobile:sync
 *   npm run mobile:apk        -> android/app/build/outputs/apk/release
 *
 * iOS (needs a Mac with Xcode):
 *   npx cap add ios
 *   MOBILE_SERVER_URL=https://tu-dominio.com npm run mobile:sync
 *   npx cap open ios          -> build and sign from Xcode
 */
const serverUrl = process.env.MOBILE_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.inversionesjcj.app",
  appName: "Inversiones JCJ",
  webDir: "mobile",
  android: {
    // The site is served over HTTPS in production; mixed content would only
    // let an attacker inject over the insecure half.
    allowMixedContent: false,
  },
  ios: {
    contentInset: "always",
  },
  server: serverUrl
    ? {
        url: serverUrl,
        // Only for pointing at a local machine during development.
        cleartext: serverUrl.startsWith("http://"),
      }
    : undefined,
};

export default config;
