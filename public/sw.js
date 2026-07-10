const CACHE_NAME = 'danumes-v2';

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker установлен');
  self.skipWaiting();
});

// Активация
self.addEventListener('activate', (event) => {
  console.log('Service Worker активирован');
  event.waitUntil(clients.claim());
});

// Обработка push-уведомлений
self.addEventListener('push', (event) => {
  console.log('Push получен:', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = {
        title: 'Новое сообщение',
        body: event.data.text()
      };
    }
  }

  const options = {
    body: data.body || 'У вас новое сообщение',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'danumes-message',
    renotify: true,
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Danumes', options)
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', (event) => {
  console.log('Клик по уведомлению');
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Если сайт уже открыт - фокусируемся на нём
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        // Иначе открываем новое окно
        if (clients.openWindow) {
          return clients.openWindow(self.location.origin);
        }
      })
  );
});

// Базовая стратегия кеширования
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
