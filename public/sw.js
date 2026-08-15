const CACHE_NAME = 'health-club-v25';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest-staff.json',
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

// Fetch event - Network First for navigation, Cache First for local assets
self.addEventListener('fetch', (event) => {
  // Ignore non-http(s) requests
  if (!event.request.url.startsWith('http')) return;

  // ONLY handle same-origin requests.
  // NEVER intercept cross-origin API calls (Supabase, Google Wallet, external services)
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Navigation requests: Try Network First
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
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
  
  // Non-GET requests: Just let the browser handle them directly
  if (event.request.method !== 'GET') {
      return;
  }

  // Other same-origin GET assets: Try Cache First, fallback to Network
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) return response;
      
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        
        if (networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
          });
        }
        
        return networkResponse;
      }).catch(() => {
        // Safe fallback if network is offline
        return caches.match(event.request);
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
    icon: (data.icon && !data.icon.includes('notification-icon.png')) ? data.icon : '/icon.png',
    badge: '/favicon-32x32.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: data.tag || data.id || 'staff-alert',
    renotify: true,
    data: data,
  };
  
  if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
    options.actions = data.actions;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if any client (tab/window) is currently focused
      const isFocused = windowClients.some(client => client.focused);
      if (isFocused) {
        console.log('[SW] App is focused. Still showing push notification for testing.');
        // return; // Commented out to ensure notifications show during testing
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
