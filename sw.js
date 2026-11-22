// Service worker : réseau d'abord (toujours à jour), cache en secours (marche hors ligne à la salle).
// cache: 'no-cache' => le navigateur revérifie chaque fichier auprès du serveur (sinon GitHub Pages
// laisse jusqu'à 10 min d'ancienne version dans le cache HTTP du téléphone).
const CACHE = 'seances-v13';
const FILES = ['./', './index.html', './style.css', './app.js', './config.js', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === location.origin;
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !isFont) return; // ex. Supabase : jamais mis en cache
  const req = sameOrigin ? new Request(e.request, { cache: 'no-cache' }) : e.request;
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok || res.type === 'opaque') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || (sameOrigin ? caches.match('./index.html') : Response.error())))
  );
});
