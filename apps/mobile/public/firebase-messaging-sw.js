/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBVoGd5UmkFS1FXupBvPw7qGIEc1mFX7RA',
  authDomain: 'quedamos-app-98250.firebaseapp.com',
  projectId: 'quedamos-app-98250',
  messagingSenderId: '743807884210',
  appId: '1:743807884210:web:ca44530aba3f453f19e2ab',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  const data = payload.data || {};
  if (title) {
    self.registration.showNotification(title, {
      body: body || '',
      icon: '/logo.png',
      data,
    });
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/tabs/plans';

  if (data.type === 'member_joined' || data.type === 'member_left') {
    url = data.groupId ? '/tabs/group/' + data.groupId : '/tabs/group';
  } else if (data.eventId) {
    url = '/tabs/plans?eventId=' + data.eventId;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
