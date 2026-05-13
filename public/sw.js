const CACHE_NAME = 'health-club-v17';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest-staff.json'
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
  // Navigation requests: Try Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Important/optional: Only cache navigation if successful
          if (response.status === 200) {
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
        
        // Only cache basic responses
        if (networkResponse.type === 'basic') {
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
    icon: data.icon || '/icon.png',
    badge: '/favicon-16x16.png',
    vibrate: [100, 50, 100], // Simpler vibrate
    tag: data.tag || 'staff-alert',
    renotify: true,
    data: data,
    actions: data.actions || []
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Health Club', options)
  );
});

// Handle notification interaction
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data || {};
  const urlToOpen = new URL(data.url || '/notifications', self.location.origin).href;
  
  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // If a window is already open, focus it
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
