// public/service-worker.js
// Service worker mínimo para que la app sea instalable y abra rápido.
// - Página (HTML): primero la red, así cada deploy se ve enseguida; sin red usa la copia.
// - Archivos con hash (/static/...): primero la caché, porque nunca cambian.
// - Firebase, Groq y cualquier otro dominio: no se tocan (los datos siempre van en vivo).
const CACHE = 'numeros-claros-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put('/index.html', copia));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  if (url.pathname.startsWith('/static/')) {
    event.respondWith(
      caches.match(req).then(enCache => enCache || fetch(req).then(res => {
        if (res.ok) {
          const copia = res.clone();
          caches.open(CACHE).then(c => c.put(req, copia));
        }
        return res;
      }))
    );
  }
});
