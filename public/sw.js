const CACHE = 'visual-framework-shell-v5';
const CORE = ['/', '/manifest.webmanifest', '/icon.svg'];

async function fetchAndCache(cache, path) {
  const response = await fetch(path, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to cache shell asset: ${path}`);
  await cache.put(path, response.clone());
  return response;
}

async function cacheCurrentShell() {
  const cache = await caches.open(CACHE);

  for (const path of CORE) {
    await fetchAndCache(cache, path);
  }

  const response = await fetch('/', { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to read current shell');
  const html = await response.clone().text();
  await cache.put('/', response);

  const references = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)]
    .map(match => match[1])
    .map(value => {
      try { return new URL(value, self.location.origin); }
      catch { return null; }
    })
    .filter(url => url && url.origin === self.location.origin && !url.pathname.startsWith('/api/'))
    .map(url => `${url.pathname}${url.search}`);

  const shellAssets = [...new Set(references.filter(path => !CORE.includes(path)))];
  await Promise.all(shellAssets.map(path => fetchAndCache(cache, path)));
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

self.addEventListener('message', event => {
  if (event.data?.type === 'CACHE_SHELL') {
    event.waitUntil(cacheCurrentShell());
  }
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    const refresh = fetch(event.request)
      .then(async response => {
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put('/', response.clone());
        }
        return response;
      });

    event.waitUntil(refresh.catch(() => undefined));
    event.respondWith(
      caches.match('/').then(async cached => {
        if (cached) return cached;
        try { return await refresh; }
        catch { return Response.error(); }
      })
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(async response => {
        if (response.ok) {
          const cache = await caches.open(CACHE);
          await cache.put(event.request, response.clone());
        }
        return response;
      });
    })
  );
});
