const CACHE_NAME = 'motoclick-pwa-v1';

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Intentamos cachear lo básico solo si aplica, pero permitimos fallos para no bloquear la instalación PWA
      return cache.addAll([
        '/',
        '/index.html',
        '/styles/main.css',
        '/js/utils.js',
        '/assets/logo.png'
      ]).catch(() => console.log('Some assets could not be cached.'));
    })
  );
  // Fuerza a que el Service Worker tome el control de inmediato
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Interceptar peticiones (Estrategia Network-First para apps con Supabase)
self.addEventListener('fetch', event => {
  // Ignorar extensiones Chrome o schemes no-http
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      // Si se pierde internet, buscar versión más reciente en caché
      const cachedResponse = await caches.match(event.request);
      if (cachedResponse) return cachedResponse;
      
      // Si no hay red ni caché, devolvemos null para que el navegador maneje el error estándar
      return null;
    })
  );
});
