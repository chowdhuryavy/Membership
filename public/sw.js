const CACHE_NAME = 'health-club-v26';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest-staff.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/icon.svg'
];

// Install event - cache assets safely
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use all instead of allSettled to ensure crucial assets are cached
      return Promise.all(
        ASSETS_TO_CACHE.map(url => cache.add(url))
      );
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});

// Fetch event - Network First for navigation, Cache First for others
self.addEventListener('fetch', (event) => {
  // Ignore non-http(s) requests (like chrome-extension, data:, etc.)
  if (!event.request.url.startsWith('http')) return;

  // Navigation requests: Try Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Important/optional: Only cache navigation if successful and http/https
          if (response.status === 200 && event.request.url.startsWith('http')) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
                // DON'T always overwrite index.html, but okay to cache the navigation request
                cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, serve index.html from cache
          return caches.match('/index.html');
        })
    );
    return;
  }
  
  // Non-GET requests: Just fetch
  if (event.request.method !== 'GET') {
      return event.respondWith(fetch(event.request));
  }

  // Other GET assets: Try Cache First, fallback to Network
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      
      return fetch(event.request).then((networkResponse) => {
        // Handle opaque responses (e.g. cross-origin)
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        
        // Only cache basic responses from http/https schemes
        const isHttp = event.request.url.startsWith('http');
        if (networkResponse.type === 'basic' && isHttp) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
          });
        }
        
        return networkResponse;
      });
    })
  );
});

// Push notification handling
self.addEventListener('push', (event) => {
  let data = { title: 'Health Club', body: 'New notification received' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      // text() might be empty, use safe fallback
      const text = event.data.text();
      data = { title: 'Health Club', body: text || 'New notification' };
    }
  }

  const options = {
    body: data.body || 'You have a new update.',
    icon: data.icon || '/pwa-192x192.png',
    badge: '/favicon-32x32.png',
    vibrate: [200, 100, 200, 100, 200], // More noticeable vibration
    tag: data.tag || data.id || 'staff-alert',
    renotify: true,
    data: data,
    actions: data.actions || []
  };

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if any client (tab/window) is currently focused
      const isFocused = windowClients.some(client => client.focused);
      if (isFocused) {
        console.log('[SW] App is focused. Skipping push notification to avoid duplication with UI toast.');
        return;
      }
      return self.registration.showNotification(data.title || 'Health Club', options);
    })
  );
});

// Handle notification interaction
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data || {};
  // Fix: HashRouter requires /#/ path to avoid 404 on PWA navigation
  const urlToOpen = new URL(data.url || '/#/notifications', self.location.origin).href;
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // If a window is already open at this URL, focus it
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
