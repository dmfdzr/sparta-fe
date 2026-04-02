// =============================================================================
// SPARTA — Service Worker
// Handles caching, offline support, push notifications, and navigation.
// =============================================================================

const CACHE_NAME = 'sparta-v1';

// Static assets to cache on install for offline shell
const STATIC_ASSETS = [
    '/',
    '/icon-192x192.png',
    '/icon-512x512.png',
    '/assets/Alfamart-Emblem.png',
    '/assets/Building-Logo.png',
];

// =============================================================================
// INSTALL — Pre-cache critical assets
// =============================================================================
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// =============================================================================
// ACTIVATE — Clean up old caches
// =============================================================================
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// =============================================================================
// FETCH — Network-first strategy with cache fallback
// =============================================================================
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip non-GET requests
    if (request.method !== 'GET') return;

    // Skip API calls and external requests — always go to network
    if (
        request.url.includes('/api/') ||
        request.url.includes('onrender.com') ||
        request.url.includes('chrome-extension')
    ) {
        return;
    }

    event.respondWith(
        fetch(request)
            .then((response) => {
                // Clone and cache successful responses
                if (response.status === 200) {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Fallback to cache if network fails
                return caches.match(request).then((cachedResponse) => {
                    if (cachedResponse) return cachedResponse;

                    // For navigation requests, return the cached homepage
                    if (request.mode === 'navigate') {
                        return caches.match('/');
                    }
                });
            })
    );
});

// =============================================================================
// PUSH — Handle push notifications
// =============================================================================
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: data.icon || '/icon-192x192.png',
            badge: '/icon-192x192.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                url: data.url || '/',
            },
        };
        event.waitUntil(
            self.registration.showNotification(data.title || 'SPARTA', options)
        );
    }
});

// =============================================================================
// NOTIFICATION CLICK — Open the app when notification is tapped
// =============================================================================
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';
    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Focus existing window if open
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        client.navigate(targetUrl);
                        return client.focus();
                    }
                }
                // Otherwise open new window
                return self.clients.openWindow(targetUrl);
            })
    );
});
