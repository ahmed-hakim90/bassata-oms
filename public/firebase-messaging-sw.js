// Placeholder service worker for browsers that still request Firebase Messaging.
// The app does not configure Firebase messaging here, so this file only prevents a noisy 404.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
