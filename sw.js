// Tomo · ricevitore: salva la pagina nel telefono, così dalla seconda volta funziona anche senza internet.
var CACHE = "tomo-ricevitore-1";
var FILE = ["./", "index.html", "jsQR.js", "ricevitore.js"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILE); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (k) {
    return Promise.all(k.filter(function (n) { return n !== CACHE; }).map(function (n) { return caches.delete(n); }));
  }));
});

// Prima la rete (per avere sempre l'ultima versione), se non c'è la copia salvata
self.addEventListener("fetch", function (e) {
  e.respondWith(
    fetch(e.request).then(function (r) {
      var copia = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copia); });
      return r;
    }).catch(function () { return caches.match(e.request); })
  );
});
