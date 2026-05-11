const CACHE_NAME = "guttrack-v1";
const OFFLINE_URLS = ["/", "/dashboard", "/log", "/insights", "/supplements", "/labs"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  const options = {
    body: data.body ?? "Check your gut health status",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag ?? "guttrack",
    data: { type: data.type ?? "general" },
    requireInteraction: false,
  };
  event.waitUntil(self.registration.showNotification(data.title ?? "GutTrack", options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const type = event.notification.data?.type;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        if (type === "feedback") {
          existing.postMessage({ type: "OPEN_FEEDBACK_MODAL" });
        }
      } else {
        self.clients.openWindow("/dashboard").then((client) => {
          if (client && type === "feedback") {
            setTimeout(() => client.postMessage({ type: "OPEN_FEEDBACK_MODAL" }), 2000);
          }
        });
      }
    })
  );
});
