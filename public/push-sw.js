// Service Worker dedicado a notificações push do Sentinela.
// NÃO faz cache de app-shell (não é um PWA offline worker) — apenas trata:
//   - push events (para futura integração VAPID/servidor)
//   - notificationclick (foca ou abre a aba de acompanhamento)
//   - message do cliente (permite disparar notificações locais mesmo com aba
//     minimizada, pois o SW permanece vivo por alguns minutos após a última mensagem).
/* eslint-disable no-restricted-globals */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Recebe payloads do cliente (usado para notificar em background curto)
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, url } = data.payload || {};
    if (!title) return;
    event.waitUntil(
      self.registration.showNotification(title, {
        body: body || '',
        tag: tag || 'sentinela',
        icon: '/icon-512.png',
        badge: '/icon-512.png',
        data: { url: url || '/' },
        renotify: true,
      })
    );
  }
});

// Suporte a Web Push real (VAPID) — caso um backend seja adicionado futuramente
self.addEventListener('push', (event) => {
  let payload = { title: 'Sentinela', body: 'Atualização disponível', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag || 'sentinela-push',
      icon: '/icon-512.png',
      badge: '/icon-512.png',
      data: { url: payload.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client) {
        try {
          await client.focus();
          if ('navigate' in client && targetUrl) client.navigate(targetUrl);
          return;
        } catch { /* noop */ }
      }
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
