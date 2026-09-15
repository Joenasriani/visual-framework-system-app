const CACHE = 'visual-framework-shell-v2';
const CORE = ['/', '/manifest.webmanifest', '/icon.svg'];

async function cacheCurrentShell() {
  const cache = await caches.open(CACHE);
  await cache.addAll(CORE);

  try {
    const response = await fetch('/', { cache: 'no-store' });
    if (!response.ok) return;
    const html = await response.clone().text();
    await cache.put('/', response);
    const paths = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
      .map(match => match[1])
      .filter(path => path.startsWith('/assets/'));
    await Promise.allSettled(paths.map(async path => {
      const asset = await fetch(path, { cache: 'no-store' });
      if (asset.ok) await cache.put(path, asset);
    }));
  } catch {
    // CORE remains available even if an asset refresh cannot complete.
  }
}

self.addEventListener('install', event => {
  event.waitUntil(cacheCurrentShell());
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)));
    await cacheCurrentShell();
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).then(async response => {
      const cache = await caches.open(CACHE);
      await cache.put('/', response.clone());
      return response;
    }).catch(() => caches.match('/')));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(async response => {
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());
    }
    return response;
  })));
});
