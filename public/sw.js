// PainCave service worker: the app keeps working with no signal at the gym or on the trail.
// App files: network first (so updates arrive), cache as fallback. Photos: cache first. /api/* is never cached.
const CACHE = 'paincave-v4'
const SHELL = ['./', './index.html', './app.css', './app.js', './icon.svg', './manifest.webmanifest', './photos/credits.json',
  './core/api.mjs', './core/browser-store.mjs', './core/program.mjs', './core/swim.mjs', './core/nutrition.mjs',
  './core/catalog/equipment.mjs', './core/catalog/exercises.mjs', './core/plan-import.mjs',
  './vendor/pdfjs/pdf.min.mjs', './vendor/pdfjs/pdf.worker.min.mjs']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u)))).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET') return
  // Exercise and cave photos come from Wikimedia Commons: keep a copy so they show offline.
  if (/(^|\.)wikimedia\.org$/.test(url.hostname)) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(e.request).then((hit) => hit ?? fetch(e.request).then((res) => {
      if (res.ok || res.type === 'opaque') c.put(e.request, res.clone())
      return res
    }))))
    return
  }
  if (url.origin !== location.origin || url.pathname.includes('/api/')) return
  if (url.pathname.includes('/photos/') && !url.pathname.endsWith('.json')) {
    e.respondWith(caches.match(e.request).then((hit) => hit ?? fetch(e.request).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)) }
      return res
    })))
    return
  }
  e.respondWith(fetch(e.request).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)) }
    return res
  }).catch(() => caches.match(e.request).then((hit) => hit ?? (e.request.mode === 'navigate' ? caches.match('./index.html') : Response.error()))))
})
