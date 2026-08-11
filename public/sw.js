const CACHE_NAME = 'health-club-v24';
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

// Fetch event - DISABLED pending debugging
self.addEventListener('fetch', (event) => {
  // Pass through all requests
  return;
});

// Push notification handling
self.addEventListener('push', (event) => {
  let data = { title: 'Health Club', body: 'New notification received' };
  
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
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
      const isFocused = windowClients.some(client => client.focused);
      if (isFocused) {
        console.log('[SW] App is focused.');
      }
      return self.registration.showNotification(data.title || 'Health Club', options);
    })
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
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
