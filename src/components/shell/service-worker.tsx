"use client";

import { useEffect } from "react";

/**
 * Registers the service worker.
 *
 * It is what lets the phone offer to install the app instead of saving a
 * bookmark, and what puts a readable notice on screen when a collector loses
 * signal. Registration is deliberately late — after the page has loaded — so
 * it never competes with the first screen for bandwidth.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    // A service worker only runs over HTTPS, plus localhost while developing.
    if (
      window.location.protocol !== "https:" &&
      window.location.hostname !== "localhost"
    ) {
      return;
    }

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // Not being installable is a smaller problem than a broken screen.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
