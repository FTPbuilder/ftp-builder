// Service worker : réseau d'abord pour la page, cache en secours (hors ligne)
const CACHE = 'ftpb-v0.13.8';
const CORE = ['./', './index.html', './manifest.webmanifest', './icon.svg', './confidentialite.html', './raccourci.html'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.hostname.endsWith('supabase.co') || u.hostname.endsWith('strava.com')) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok && (u.origin === location.origin || u.hostname.includes('jsdelivr') || u.hostname.includes('gstatic') || u.hostname.includes('googleapis'))) { const c = r.clone(); caches.open(CACHE).then(ca => ca.put(e.request, c)); } return r; }).catch(() => caches.match(e.request).then(m => m || caches.match('./index.html'))));
});
