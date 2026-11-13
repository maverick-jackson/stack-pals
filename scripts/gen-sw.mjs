// Writes dist/sw.js with every built file precached, so the game works offline after one visit.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(relative(dist, p));
  }
};
walk(dist);
const assets = files.filter((f) => f !== 'sw.js' && !f.endsWith('.woff')).sort();
const hash = createHash('sha256');
for (const f of assets) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);
const list = ['./', ...assets.map((f) => `./${f}`)];

const sw = `const CACHE = 'stack-pals-${version}';
const ASSETS = ${JSON.stringify(list)};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// The page itself is network first, so a new release shows up on the next open.
// Hashed assets never change, so they are cache first. Offline falls back to the cache.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put('./', res.clone()));
          return res;
        })
        .catch(() => caches.match('./')),
    );
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
`;
writeFileSync(join(dist, 'sw.js'), sw);
console.log(`sw.js: ${list.length} files, cache ${version}`);
