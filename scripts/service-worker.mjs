import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const files = [
  "/",
  "/index.html",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
  "/crop-worker.js",
  ...(await readdir("dist/assets")).map((f) => "/assets/" + f),
];
const hash = createHash("sha256")
  .update(await readFile("dist/index.html"))
  // Cached responses include CSP headers, so security-policy changes need a new cache.
  .update(await readFile("dist/_headers"))
  .update(await readFile("worker/index.ts"))
  .update(await readFile("wrangler.jsonc"))
  .digest("hex")
  .slice(0, 12);
await writeFile(
  "dist/sw.js",
  `const CACHE='visitkort-shell-${hash}';const FILES=${JSON.stringify(files)};self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)));self.skipWaiting()});self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('visitkort-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin||e.request.method!=='GET'||u.pathname.startsWith('/api/'))return;if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match('/index.html')));return}if(FILES.includes(u.pathname)||u.pathname==='/opencv.js')e.respondWith(caches.match(e.request).then(c=>c||fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(cache=>cache.put(e.request,copy)))}return r})));});`,
);
