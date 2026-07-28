// Service worker minimal — nécessaire pour que le navigateur propose
// "Installer l'application" / "Ajouter à l'écran d'accueil".
// On ne met rien en cache pour l'instant : tout passe simplement par le réseau.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});

// Réception d'une notification push envoyée par le serveur
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) { data = { body: event.data ? event.data.text() : "" }; }
  const title = data.title || "AffiniX";
  const options = {
    body: data.body || "",
    icon: "icon-192.png",
    badge: "icon-192.png"
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clic sur la notification : ouvre (ou remet au premier plan) le dashboard
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("./index.html");
    })
  );
});
