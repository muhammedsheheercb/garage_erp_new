// Retire service workers registered by earlier versions of the application.
// No fetch handler: requests continue directly to the server.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.registration.unregister());
});
