/* Calculator-scoped offline cache. Never caches API writes or experiment pages. */
const cacheName = 'labnest-calculator-shell-v3';
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type !== 'CACHE_CALCULATOR') return;
  event.waitUntil((async () => {
    const cache = await caches.open(cacheName);
    const urls = [...new Set(event.data.urls)].filter(value => {
      try { const url = new URL(value);return url.origin === self.location.origin && (url.pathname.startsWith('/tools/calculator') || url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/lab-soft-v1/')); } catch { return false; }
    });
    try {
      for (const url of urls) { const response = await fetch(url);if (!response.ok) throw new Error('Cache request failed');await cache.put(url,response); }
      event.ports[0]?.postMessage({ok:true});
    } catch { event.ports[0]?.postMessage({ok:false}); }
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !(url.pathname.startsWith('/tools/calculator') || url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/lab-soft-v1/'))) return;
  // RSC transport is not interchangeable with a document and is never used as an offline HTML fallback.
  if (event.request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName);
    try { const response = await fetch(event.request);if(response.ok)await cache.put(event.request,response.clone());return response; }
    catch { const cached = await cache.match(event.request);if(cached)return cached;return new Response('此页面尚未缓存 / This page has not been cached',{status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}}); }
  })());
});
