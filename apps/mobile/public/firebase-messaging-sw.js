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
  // Web tokens now receive a data-only payload (no top-level `notification`) — the backend
  // splits sends by platform so @firebase/messaging never shows its own duplicate
  // notification on top of the one we show below. Read title/body from `data` first, with
  // a fallback to `notification` for resilience during rollout (old backend + new SW).
  const data = payload.data || {};
  const notification = payload.notification || {};
  const title = data.title || notification.title;
  const body = data.body || notification.body;
  const isPoll = data.type === 'new_poll';
  if (title) {
    self.registration.showNotification(title, {
      body: body || '',
      icon: '/logo.png',
      data,
      // Action buttons let the user answer straight from the notification, without
      // opening the app first — only for an open question, never for other types
      // (poll_completed included: it has nothing to answer). Android native ignores
      // `actions` (unsupported by @capacitor/push-notifications@7) and falls back to
      // the deep link on tap, same as before this change.
      ...(isPoll && {
        actions: [
          { action: 'yes', title: 'Puedo' },
          { action: 'no', title: 'No puedo' },
        ],
      }),
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
  // event.action is '' when the notification body is clicked (no button involved) and
  // the id of the pressed button ('yes'/'no') when an action button is clicked. Any
  // other value is treated the same as no answer — only an exact 'yes'/'no' precharges
  // the mazo's auto-submit (usePollDeepLink.ts / Mazo.tsx, Task 7).
  const answer = event.action;
  let url = '/tabs/plans';

  if (data.type === 'member_joined' || data.type === 'member_left') {
    // Same UUID validation + fallback as navigateFromPush's validGroupId — a garbage
    // groupId must not end up in the URL, it should just fall back to the groupless route.
    const memberGroupOk = typeof data.groupId === 'string' && UUID_RE.test(data.groupId);
    url = memberGroupOk ? '/tabs/group/' + data.groupId : '/tabs/group';
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
    const answerOk = answer === 'yes' || answer === 'no';
    const pollParams = new URLSearchParams();
    if (pollOk) pollParams.set('pollId', data.pollId);
    if (groupOk) pollParams.set('groupId', data.groupId);
    // Gated on pollOk too: an answer with no pollId to attach it to is inert (Mazo.tsx's
    // auto-submit guard requires a non-null focusPollId), so there is no reason to leak it
    // into the URL when pollId is missing or invalid.
    if (answerOk && pollOk) pollParams.set('answer', answer);
    const pollQuery = pollParams.toString();
    url = pollQuery ? '/tabs/calendar?' + pollQuery : '/tabs/calendar';
  } else if (data.type === 'poll_completed') {
    url = '/tabs/calendar';
  } else if (typeof data.eventId === 'string' && UUID_RE.test(data.eventId)) {
    // Same UUID validation as navigateFromPush's validEventId — an invalid eventId falls
    // through to the '/tabs/plans' default set above, same as that fallback.
    url = '/tabs/plans?eventId=' + data.eventId;
  }

  event.waitUntil(
    (async () => {
      const windowClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          try {
            await client.focus();
            await client.navigate(url);
            return;
          } catch {
            // matchAll({ includeUncontrolled: true }) can return windows this SW doesn't
            // actually control (e.g. a tab loaded before this SW took over) — navigate()
            // rejects with InvalidStateError for those. That used to just mean "wrong page
            // opens"; now it would silently drop the answer the user just tapped a button
            // for, since `answer` only travels in the destination URL. Falling through to
            // openWindow instead of leaving this rejection unobserved guarantees the
            // answer still reaches a real, controlled page.
            break;
          }
        }
      }
      return clients.openWindow(url);
    })()
  );
});
