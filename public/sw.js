const CACHE_NAME = 'health-club-v10';
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
      return Promise.allSettled(
        ASSETS_TO_CACHE.map(url => cache.add(url).catch(err => console.warn('SW Cache failed for:', url)))
      );
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
  event.waitUntil(
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
  );
});

// Fetch event - Network First for navigation, Cache First for others
self.addEventListener('fetch', (event) => {
  // Navigation requests: Try Network First, fallback to Cache
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update the cache with the fresh version
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put('/index.html', responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, serve from cache
          return caches.match('/index.html');
        })
    );
    return;
  }

  // Other assets: Try Cache First, fallback to Network
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

// Push notification handling
self.addEventListener('push', (event) => {
  let data = { title: 'Identity Sync', body: 'New notification received' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Identity Sync', body: event.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/icon.png',
    badge: '/favicon-16x16.png',
    vibrate: [100, 50, 100, 50, 200, 100, 400], // Unique "Identity Sync" rhythm
    tag: 'staff-alert',
    renotify: true,
    data: data,
    // Modern browsers generally ignore the sound property in showNotification
    // but system-level wrappers (APK) sometimes use it or the default
    sound: '/sounds/notification-uncommon.mp3' 
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Handle notification interaction
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const urlToOpen = new URL('/staff-schedule', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({
      type: 'window',
      includeUncontrolled: true
    }).then((windowClients) => {
      // If a window is already open, focus it
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
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
