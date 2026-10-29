const CACHE = 'lucas5g-v36';
const ASSETS = ['./', 'index.html', 'style.css?v=25', 'game.js?v=33', 'manifest.json?v=2',
  'img/gamer.webp', 'img/ayuda.webp', 'img/sala.webp', 'img/items/calabaza.webp', 'img/items/copa_oro.webp', 'img/items/copa_plata.webp', 'img/logo.webp', 'img/caido.webp', 'img/luna.webp', 'img/altos.webp', 'img/altos-luz.webp', 'img/bajos.webp', 'img/bajos-luz.webp', 'img/capa.webp', 'img/superlucas.webp', 'img/vuela.webp', 'img/saluda.webp', 'img/celebra.webp', 'img/duda.webp', 'img/senala.webp', 'img/mando.webp',
  'img/switch.webp', 'img/telefono.webp', 'img/portatil.webp', 'img/halloween.webp', 'img/navidad.webp', 'img/piscina.webp',
  'img/icon-192.png?v=2', 'img/icon-512.png?v=2', 'img/icon-180.png?v=2', 'favicon.ico?v=2'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.endsWith('version.json')) return;                 // la versión siempre se pide a internet
  const pagina = e.request.mode === 'navigate' || u.pathname.endsWith('/') || u.pathname.endsWith('.html');
  if (pagina) {   // la página: primero internet (así siempre llega lo nuevo); sin conexión, la copia guardada
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); } return r; })
      .catch(() => caches.match(e.request).then(h => h || caches.match('./'))));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request);
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
