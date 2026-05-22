// GET /api/firebase-messaging-sw — serves the Firebase messaging service worker
// with Firebase config injected server-side (SW files can't read env vars)
export async function GET() {
  const config = {
    apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const sw = `
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp(${JSON.stringify(config)});
const messaging = firebase.messaging();

// Handle background push messages (app is closed or in background)
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? 'Personal OS';
  const body  = payload.notification?.body  ?? '';
  self.registration.showNotification(title, {
    body,
    icon:  '/icons/icon.svg',
    badge: '/icons/icon.svg',
    data:  payload.data ?? {},
  });
});

// Open / focus the app when a notification is clicked
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
`;

  return new Response(sw, {
    headers: {
      "Content-Type": "application/javascript",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
