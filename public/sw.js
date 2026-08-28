/**
 * Service Worker für Kassensturz.
 *
 * Ziel: Die App startet auch ohne Internet. Deshalb:
 *  - Seitenaufrufe: erst Netz, sonst die gespeicherte Startseite.
 *    (So bekommt man online immer die neueste Version.)
 *  - Dateien mit Namens-Prüfsumme (Vite): erst Cache, sonst Netz.
 *    (Die ändern sich nie, ein neuer Build hat neue Namen.)
 */
const VERSION = "kassensturz-__BUILD_ID__";
const SHELL = "./";

// Wird nach dem Build eingesetzt: alle Dateien mit Prüfsumme aus diesem Build.
const ASSETS = ["__ASSETS__"].filter((a) => a && !a.startsWith("__"));

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) =>
      cache.addAll([
        SHELL,
        "./manifest.webmanifest",
        "./icons/icon-192.png",
        "./icons/icon-512.png",
        "./icons/favicon.svg",
        ...ASSETS,
      ]),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Seitenaufruf: Netz zuerst, offline die gespeicherte Startseite.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(VERSION).then((c) => c.put(SHELL, copy));
          return response;
        })
        .catch(() => caches.match(SHELL).then((r) => r ?? Response.error())),
    );
    return;
  }

  if (!sameOrigin && url.hostname !== "fonts.gstatic.com" && url.hostname !== "fonts.googleapis.com") {
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ??
        fetch(request)
          .then((response) => {
            if (response.ok && (response.type === "basic" || response.type === "cors")) {
              const copy = response.clone();
              void caches.open(VERSION).then((c) => c.put(request, copy));
            }
            return response;
          })
          .catch(() => cached ?? Response.error()),
    ),
  );
});
