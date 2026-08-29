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

// Kept in sync by hand with the equivalent switch in navigateFromPush
// (src/lib/push-notifications.ts) — this file has no test suite, so any change to the
// routing here must be mirrored there (and vice versa).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let url = '/tabs/plans';

  if (data.type === 'member_joined' || data.type === 'member_left') {
    url = data.groupId ? '/tabs/group/' + data.groupId : '/tabs/group';
  } else if (data.type === 'new_poll') {
    // poll_completed is informational only ("El aro se cierra") — its poll is already
    // `completed`, so the mazo can never focus/consume a pollId for it. Only an open
    // question (new_poll) gets the deep-link param.
    //
    // groupId travels alongside pollId here too: this service worker has no access to
    // the page's localStorage (unlike navigateFromPush, which also persists it there),
    // so the URL is the only channel available to select the right group on reload.
    // Each field validates independently — garbage in one must not suppress the other.
    const pollOk = typeof data.pollId === 'string' && UUID_RE.test(data.pollId);
    const groupOk = typeof data.groupId === 'string' && UUID_RE.test(data.groupId);
    const pollParams = new URLSearchParams();
    if (pollOk) pollParams.set('pollId', data.pollId);
    if (groupOk) pollParams.set('groupId', data.groupId);
    const pollQuery = pollParams.toString();
    url = pollQuery ? '/tabs/calendar?' + pollQuery : '/tabs/calendar';
  } else if (data.type === 'poll_completed') {
    url = '/tabs/calendar';
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
