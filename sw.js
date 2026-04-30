// A basic service worker to satisfy the PWA installation requirement
const CACHE_NAME = 'ecolocker-v1';

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installed');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activated');
});

// The browser REQUIRES a fetch event handler to trigger the install prompt
self.addEventListener('fetch', (event) => {
    // For now, we just let the network handle it normally. 
    // We will add true offline caching here later!
    event.respondWith(fetch(event.request));
});