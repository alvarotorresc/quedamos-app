/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.9.0/firebase-messaging-compat.js');

// The Firebase web config arrives in the query string this worker was registered with
// (src/lib/push-notifications.ts -> registerWeb), read from the env through src/lib/env.ts.
// It used to be hardcoded here, a second copy free to drift from the env the app itself
// uses. None of it is secret — it is the public web config, shipped in every bundle — but
// there must be exactly one source for it.
const swConfig = new URLSearchParams(self.location.search);
const firebaseConfig = {
  apiKey: swConfig.get('apiKey'),
  authDomain: swConfig.get('authDomain'),
  projectId: swConfig.get('projectId'),
  messagingSenderId: swConfig.get('messagingSenderId'),
  appId: swConfig.get('appId'),
};

// Without a config there is nothing to receive: skip initialising rather than throw on
// every worker start. The notificationclick handler below is registered either way, so
// notifications already on screen still route correctly.
if (
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
) {
  firebase.initializeApp(firebaseConfig);

  firebase.messaging().onBackgroundMessage((payload) => {
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
        //
        // The labels come localized from the API (data.yesLabel / data.noLabel); the
        // Spanish literals are the fallback for a payload sent before that shipped. A
        // worker cannot read the app's i18n, so the alternative was hardcoding Spanish
        // for everyone.
        ...(isPoll && {
          actions: [
            { action: 'yes', title: data.yesLabel || 'Puedo' },
            { action: 'no', title: data.noLabel || 'No puedo' },
          ],
        }),
      });
    }
  });
}

// ---------------------------------------------------------------------------
// Push routing — mirror of src/lib/push-routes.ts.
//
// This worker cannot import ES modules (it needs importScripts for the compat SDK), so
// the table and the resolver are copied by hand. src/lib/push-routes.test.ts parses
// PUSH_ROUTE_TABLE out of this file and runs the same cases against both
// implementations: a change on one side alone fails the suite. Keep the literal below
// simple enough to parse — one "type": "target" pair per line.
// ---------------------------------------------------------------------------
const PUSH_ROUTE_TABLE = {
  "new_event": "event",
  "event_updated": "event",
  "event_deleted": "event",
  "event_cancelled": "event",
  "event_confirmed": "event",
  "event_declined": "event",
  "event_reminder": "event",
  "proposal_converted": "event",
  "new_proposal": "proposal",
  "proposal_voted": "proposal",
  "new_poll": "poll",
  "poll_completed": "calendar",
  "weekly_availability_reminder": "calendar",
  "member_joined": "group",
  "member_left": "group",
  "role_changed": "group",
  "member_kicked": "groupList",
  "group_deleted": "groupList"
};

const PUSH_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validPushId(value) {
  return typeof value === 'string' && PUSH_UUID_RE.test(value) ? value : undefined;
}

function pushRouteUrl(data, answer) {
  const groupId = validPushId(data.groupId);
  const eventId = validPushId(data.eventId);
  const proposalId = validPushId(data.proposalId);
  const pollId = validPushId(data.pollId);

  const type = data.type || '';
  const known = Object.prototype.hasOwnProperty.call(PUSH_ROUTE_TABLE, type);
  const target = known ? PUSH_ROUTE_TABLE[type] : eventId ? 'event' : 'plans';

  if (target === 'groupList') return '/tabs/group';
  if (target === 'group') return groupId ? '/tabs/group/' + groupId : '/tabs/group';

  const params = new URLSearchParams();

  if (target === 'poll') {
    if (pollId) params.set('pollId', pollId);
    if (groupId) params.set('groupId', groupId);
    if (pollId && (answer === 'yes' || answer === 'no')) params.set('answer', answer);
    return withPushQuery('/tabs/calendar', params);
  }

  if (target === 'calendar') {
    if (groupId) params.set('groupId', groupId);
    return withPushQuery('/tabs/calendar', params);
  }

  if (target === 'event' && eventId) params.set('eventId', eventId);
  if (target === 'proposal' && proposalId) params.set('proposalId', proposalId);
  if (groupId) params.set('groupId', groupId);
  return withPushQuery('/tabs/plans', params);
}

function withPushQuery(path, params) {
  const query = params.toString();
  return query ? path + '?' + query : path;
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  // event.action is '' when the notification body is clicked (no button involved) and
  // the id of the pressed button ('yes'/'no') when an action button is clicked. Any
  // other value is treated the same as no answer — only an exact 'yes'/'no' precharges
  // the mazo's auto-submit (usePollDeepLink.ts / Mazo.tsx).
  const url = pushRouteUrl(data, event.action);

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
