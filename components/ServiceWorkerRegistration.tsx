"use client";
import { useEffect } from "react";

/** Registers /sw.js so the app qualifies as an installable PWA on Android,
 *  which activates the share_target declared in /manifest.json. */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
