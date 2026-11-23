/* Service worker de Torneos de Tenis.
   - La página (index.html) va "red primero": siempre se descarga la versión nueva si hay internet;
     sin internet se abre la última guardada.
   - Íconos, manifiesto y librerías externas (Tailwind, Firebase JS): se sirven de caché y se actualizan en segundo plano.
   - Los datos (Firebase: firebaseio.com, googleapis.com) NUNCA pasan por aquí: siempre van directo a la red.
   Para forzar que todos descarguen de nuevo los archivos, cambia VERSION. */
const VERSION = 'v1';
const CACHE = 'tenis-' + VERSION;
const PRECACHE = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/favicon-32.png'];
const EXTERNOS = ['cdn.tailwindcss.com', 'www.gstatic.com'];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE).then(c => Promise.all(PRECACHE.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('tenis-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

function conTiempo(p, ms) { return new Promise((ok, mal) => { let t = setTimeout(() => mal(new Error('tiempo')), ms); p.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); mal(e); }); }); }

self.addEventListener('fetch', e => {
    const req = e.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    const propio = url.origin === self.location.origin;
    if (!propio && !EXTERNOS.includes(url.hostname)) return;            // Firebase y todo lo demás: directo a la red

    if (req.mode === 'navigate') {                                       // la página: red primero, caché de respaldo
        e.respondWith((async () => {
            const c = await caches.open(CACHE);
            try {
                const r = await conTiempo(fetch(req), 5000);
                if (r && r.ok) c.put('/', r.clone());
                return r;
            } catch (err) {
                return (await c.match('/')) || (await c.match('/index.html')) || Response.error();
            }
        })());
        return;
    }
    if (propio && url.pathname === '/sw.js') return;
    e.respondWith((async () => {                                         // recursos: caché y actualización en segundo plano
        const c = await caches.open(CACHE);
        const guardado = await c.match(req, { ignoreSearch: false });
        const red = fetch(req).then(r => { if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone()); return r; }).catch(() => null);
        return guardado || (await red) || Response.error();
    })());
});
