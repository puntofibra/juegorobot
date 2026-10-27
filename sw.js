const CACHE = 'lucas5g-v9';
const ASSETS = ['./', 'index.html', 'style.css?v=5', 'game.js?v=9', 'manifest.json',
  'img/caido.webp', 'img/luna.webp', 'img/altos.webp', 'img/altos-luz.webp', 'img/bajos.webp', 'img/bajos-luz.webp', 'img/capa.webp', 'img/superlucas.webp', 'img/vuela.webp', 'img/saluda.webp', 'img/celebra.webp', 'img/duda.webp', 'img/senala.webp', 'img/mando.webp',
  'img/switch.webp', 'img/telefono.webp', 'img/portatil.webp', 'img/halloween.webp', 'img/navidad.webp', 'img/piscina.webp',
  'img/icon-192.png', 'img/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(e.request);
    const net = fetch(e.request).then(r => { if (r.ok) c.put(e.request, r.clone()); return r; }).catch(() => hit);
    return hit || net;
  }));
});
