/* global firebase */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDn9VYTp8VfsxWQADAtozRmrCySzlETwas',
  authDomain: 'auth.radioconexionweb.com',
  projectId: 'radio-conexion-e924e',
  storageBucket: 'radio-conexion-e924e.firebasestorage.app',
  messagingSenderId: '164161520710',
  appId: '1:164161520710:web:20e761ce7dae6d2c637647'
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || 'Radio Conexión', {
    body: notification.body || 'Hay una novedad para ti.',
    icon: 'https://www.dropbox.com/scl/fi/7h2pubomnn102d1rap4dr/Sin-Texto-versi-n-3D.png?rlkey=nd66shyykgea25m8c6sl2pp5d&raw=1',
    data: { url: payload.data?.url || '/inicio.html' }
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/inicio.html'));
});
