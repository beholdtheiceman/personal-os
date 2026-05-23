// Minimal service worker — enables PWA install and Web Share Target on Android.
// No caching strategy; all requests pass through to the network normally.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
