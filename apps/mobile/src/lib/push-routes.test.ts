import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, vi } from 'vitest';
import { PUSH_ROUTE_TABLE, resolvePushRoute } from './push-routes';

/**
 * The service worker is a classic worker (importScripts for the Firebase compat SDK), so
 * it cannot import push-routes.ts and keeps a hand-copied mirror of the table and the
 * resolver. These tests are what keeps the copy honest: the table is parsed straight out
 * of the file and compared in both directions, and every routing case below runs twice —
 * once against resolvePushRoute() and once against the worker's real notificationclick
 * handler, evaluated here with the worker globals stubbed.
 */
// import.meta.url is an http:// URL under the jsdom environment, so resolve from the
// working directory instead: apps/mobile when vitest runs there, the repo root when a
// runner starts it from above.
const SW_PATH = ['public', 'apps/mobile/public']
  .map((dir) => resolve(process.cwd(), dir, 'firebase-messaging-sw.js'))
  .find((candidate) => existsSync(candidate));
if (!SW_PATH) throw new Error('firebase-messaging-sw.js not found from ' + process.cwd());
const SW_SOURCE = readFileSync(SW_PATH, 'utf8');

const importScriptsNoop = vi.fn();

const ORIGIN = 'https://quedamos.alvarotc.com';
const CONFIG_SEARCH =
  '?apiKey=test-key&authDomain=test.firebaseapp.com&projectId=test-project&messagingSenderId=123&appId=1:123:web:abc';

interface ShownNotification {
  title: string;
  options: Record<string, unknown>;
}

interface BackgroundPayload {
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
}

interface SwHarness {
  notificationClick: (data: Record<string, string>, action?: string) => Promise<void>;
  backgroundMessage: (payload: BackgroundPayload) => void;
  hasBackgroundHandler: () => boolean;
  shown: ShownNotification[];
  navigated: string[];
  opened: string[];
  initializeApp: ReturnType<typeof vi.fn>;
}

function loadServiceWorker(
  options: { search?: string; clientUrls?: string[]; navigateFails?: boolean } = {},
): SwHarness {
  const shown: ShownNotification[] = [];
  const navigated: string[] = [];
  const opened: string[] = [];
  const listeners: Record<string, (event: unknown) => void> = {};
  let backgroundHandler: ((payload: BackgroundPayload) => void) | null = null;

  const initializeApp = vi.fn();
  const firebase = {
    initializeApp,
    messaging: () => ({
      onBackgroundMessage: (cb: (payload: BackgroundPayload) => void) => {
        backgroundHandler = cb;
      },
    }),
  };

  const selfStub = {
    location: { search: options.search ?? CONFIG_SEARCH, origin: ORIGIN },
    registration: {
      showNotification: (title: string, opts: Record<string, unknown>) => {
        shown.push({ title, options: opts });
        return Promise.resolve();
      },
    },
    addEventListener: (name: string, cb: (event: unknown) => void) => {
      listeners[name] = cb;
    },
  };

  const clientList = (options.clientUrls ?? []).map((url) => ({
    url,
    focus: vi.fn().mockResolvedValue(undefined),
    navigate: options.navigateFails
      ? vi.fn().mockRejectedValue(new Error('InvalidStateError'))
      : vi.fn(async (target: string) => {
          navigated.push(target);
        }),
  }));

  const clients = {
    matchAll: async () => clientList,
    openWindow: async (target: string) => {
      opened.push(target);
    },
  };

  const run = new Function('self', 'clients', 'importScripts', 'firebase', SW_SOURCE);
  run(selfStub, clients, importScriptsNoop, firebase);

  return {
    shown,
    navigated,
    opened,
    initializeApp,
    hasBackgroundHandler: () => backgroundHandler !== null,
    backgroundMessage: (payload) => {
      if (!backgroundHandler) throw new Error('onBackgroundMessage was never registered');
      backgroundHandler(payload);
    },
    notificationClick: async (data, action = '') => {
      const handler = listeners.notificationclick;
      if (!handler) throw new Error('notificationclick was never registered');
      let pending: Promise<unknown> | undefined;
      handler({
        notification: { data, close: vi.fn() },
        action,
        // The handler does its work inside event.waitUntil(): without capturing the
        // promise, the assertions would run before the async IIFE resolved.
        waitUntil: (promise: Promise<unknown>) => {
          pending = promise;
        },
      });
      await pending;
    },
  };
}


const GROUP = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const PROPOSAL = '33333333-3333-4333-8333-333333333333';
const POLL = '44444444-4444-4444-8444-444444444444';

interface RouteCase {
  name: string;
  data: Record<string, string>;
  answer?: string;
  /** null for a push that opens nothing at all. */
  url: string | null;
}

const CASES: RouteCase[] = [
  {
    name: 'new_event opens the plan',
    data: { type: 'new_event', eventId: EVENT, groupId: GROUP },
    url: `/tabs/plans?eventId=${EVENT}&groupId=${GROUP}`,
  },
  {
    name: 'event_updated opens the plan',
    data: { type: 'event_updated', eventId: EVENT, groupId: GROUP },
    url: `/tabs/plans?eventId=${EVENT}&groupId=${GROUP}`,
  },
  {
    name: 'event_deleted opens the plan',
    data: { type: 'event_deleted', eventId: EVENT, groupId: GROUP },
    url: `/tabs/plans?eventId=${EVENT}&groupId=${GROUP}`,
  },
  {
    name: 'event_cancelled opens the plan',
    data: { type: 'event_cancelled', eventId: EVENT, groupId: GROUP },
    url: `/tabs/plans?eventId=${EVENT}&groupId=${GROUP}`,
  },
  {
    name: 'event_confirmed opens the plan',
    data: { type: 'event_confirmed', eventId: EVENT, groupId: GROUP },
    url: `/tabs/plans?eventId=${EVENT}&groupId=${GROUP}`,
  },
  {
    name: 'event_declined opens the plan',
    data: { type: 'event_declined', eventId: EVENT, groupId: GROUP },
    url: `/tabs/plans?eventId=${EVENT}&groupId=${GROUP}`,
  },
  {
    name: 'event_reminder opens the plan',
    data: { type: 'event_reminder', eventId: EVENT, groupId: GROUP },
    url: `/tabs/plans?eventId=${EVENT}&groupId=${GROUP}`,
  },
  {
    name: 'proposal_converted opens the plan it became, not the proposal',
    data: { type: 'proposal_converted', proposalId: PROPOSAL, eventId: EVENT, groupId: GROUP },
    url: `/tabs/plans?eventId=${EVENT}&groupId=${GROUP}`,
  },
  {
    name: 'new_proposal opens the proposal',
    data: { type: 'new_proposal', proposalId: PROPOSAL, groupId: GROUP },
    url: `/tabs/plans?proposalId=${PROPOSAL}&groupId=${GROUP}`,
  },
  {
    name: 'proposal_voted opens the proposal',
    data: { type: 'proposal_voted', proposalId: PROPOSAL, groupId: GROUP },
    url: `/tabs/plans?proposalId=${PROPOSAL}&groupId=${GROUP}`,
  },
  {
    name: 'new_poll opens the question in the calendar',
    data: { type: 'new_poll', pollId: POLL, groupId: GROUP, date: '2026-09-12' },
    url: `/tabs/calendar?pollId=${POLL}&groupId=${GROUP}`,
  },
  {
    name: 'new_poll carries the answer tapped on the action button',
    data: { type: 'new_poll', pollId: POLL, groupId: GROUP },
    answer: 'yes',
    url: `/tabs/calendar?pollId=${POLL}&groupId=${GROUP}&answer=yes`,
  },
  {
    name: 'new_poll drops an answer with no question to attach it to',
    data: { type: 'new_poll', pollId: 'not-a-uuid', groupId: GROUP },
    answer: 'no',
    url: `/tabs/calendar?groupId=${GROUP}`,
  },
  {
    name: 'new_poll keeps the pollId when the groupId is garbage',
    data: { type: 'new_poll', pollId: POLL, groupId: 'nope' },
    url: `/tabs/calendar?pollId=${POLL}`,
  },
  {
    name: 'poll_completed opens the calendar with nothing focused',
    data: { type: 'poll_completed', pollId: POLL, groupId: GROUP },
    url: `/tabs/calendar?groupId=${GROUP}`,
  },
  {
    name: 'weekly_availability_reminder opens the calendar',
    data: { type: 'weekly_availability_reminder' },
    url: '/tabs/calendar',
  },
  {
    name: 'member_joined opens the group',
    data: { type: 'member_joined', groupId: GROUP },
    url: `/tabs/group/${GROUP}`,
  },
  {
    name: 'member_left opens the group',
    data: { type: 'member_left', groupId: GROUP },
    url: `/tabs/group/${GROUP}`,
  },
  {
    name: 'role_changed opens the group',
    data: { type: 'role_changed', groupId: GROUP },
    url: `/tabs/group/${GROUP}`,
  },
  {
    name: 'member_joined without a groupId falls back to the list',
    data: { type: 'member_joined' },
    url: '/tabs/group',
  },
  {
    name: 'member_kicked opens the list, never the group you are out of',
    data: { type: 'member_kicked', groupId: GROUP },
    url: '/tabs/group',
  },
  {
    name: 'group_deleted opens the list',
    data: { type: 'group_deleted', groupId: GROUP },
    url: '/tabs/group',
  },
  {
    name: 'widget_refresh opens nothing: it is machinery, not an announcement',
    data: { type: 'widget_refresh', groupId: GROUP },
    url: null,
  },
  {
    name: 'an unknown type with an eventId still opens the plan',
    data: { type: 'something_new', eventId: EVENT },
    url: `/tabs/plans?eventId=${EVENT}`,
  },
  {
    name: 'an unknown type without an eventId opens Planes',
    data: { type: 'something_new' },
    url: '/tabs/plans',
  },
  {
    name: 'an inherited Object member is not a route',
    data: { type: 'constructor' },
    url: '/tabs/plans',
  },
  {
    name: 'an event type with a garbage eventId does not put it in the URL',
    data: { type: 'new_event', eventId: 'nope', groupId: GROUP },
    url: `/tabs/plans?groupId=${GROUP}`,
  },
];

describe('push routing', () => {
  describe('resolvePushRoute', () => {
    for (const testCase of CASES) {
      it(testCase.name, () => {
        const route = resolvePushRoute(testCase.data, testCase.answer);
        if (testCase.url === null) {
          expect(route).toBeNull();
          return;
        }
        expect(route?.url).toBe(testCase.url);
      });
    }
  });

  describe('the service worker resolves the same URLs', () => {
    for (const testCase of CASES) {
      it(testCase.name, async () => {
        // Only the "opens nothing" case gets a tab already open, so both escape hatches
        // — navigating that tab and opening a new window — can be shown not to fire. The
        // rest keep asserting on openWindow, as they did before widget_refresh existed.
        const sw = loadServiceWorker(
          testCase.url === null ? { clientUrls: [`${ORIGIN}/tabs/calendar`] } : {},
        );

        await sw.notificationClick(testCase.data, testCase.answer ?? '');

        if (testCase.url === null) {
          expect(sw.opened).toEqual([]);
          expect(sw.navigated).toEqual([]);
          return;
        }
        expect(sw.opened).toEqual([testCase.url]);
      });
    }
  });

  describe('the routing table is the same on both sides', () => {
    function tableFromServiceWorker(): Record<string, string> {
      const block = SW_SOURCE.match(/const PUSH_ROUTE_TABLE = \{([\s\S]*?)\};/);
      if (!block) throw new Error('PUSH_ROUTE_TABLE not found in the service worker');
      const table: Record<string, string> = {};
      for (const [, type, target] of block[1].matchAll(
        /['"]?([A-Za-z_][A-Za-z0-9_]*)['"]?\s*:\s*['"]([A-Za-z]+)['"]/g,
      )) {
        table[type] = target;
      }
      return table;
    }

    it('parses a non-empty table out of the worker', () => {
      expect(Object.keys(tableFromServiceWorker()).length).toBeGreaterThan(10);
    });

    it('matches push-routes.ts entry for entry, in both directions', () => {
      expect(tableFromServiceWorker()).toEqual(PUSH_ROUTE_TABLE);
    });
  });

  describe('which group is remembered', () => {
    it('remembers the group when the push points inside one you are in', () => {
      expect(resolvePushRoute({ type: 'new_event', eventId: EVENT, groupId: GROUP })).toMatchObject(
        { persistGroupId: GROUP },
      );
      expect(resolvePushRoute({ type: 'role_changed', groupId: GROUP })).toMatchObject({
        persistGroupId: GROUP,
      });
      expect(resolvePushRoute({ type: 'new_poll', pollId: POLL, groupId: GROUP })).toMatchObject({
        persistGroupId: GROUP,
      });
    });

    it('asks to forget it — never to remember it — when you are out of the group', () => {
      for (const type of ['member_kicked', 'group_deleted']) {
        const route = resolvePushRoute({ type, groupId: GROUP });
        expect(route.persistGroupId).toBeUndefined();
        expect(route.forgetGroupId).toBe(GROUP);
      }
    });

    it('never remembers a groupId that is not a UUID', () => {
      expect(
        resolvePushRoute({ type: 'member_joined', groupId: 'javascript:alert(1)' }).persistGroupId,
      ).toBeUndefined();
    });
  });

  describe('the service worker Firebase config', () => {
    it('initialises from the query string it was registered with, not a hardcoded copy', () => {
      const sw = loadServiceWorker({ search: CONFIG_SEARCH });

      expect(sw.initializeApp).toHaveBeenCalledWith({
        apiKey: 'test-key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test-project',
        messagingSenderId: '123',
        appId: '1:123:web:abc',
      });
    });

    it('does not initialise — and does not throw — when the config is missing', () => {
      const sw = loadServiceWorker({ search: '' });

      expect(sw.initializeApp).not.toHaveBeenCalled();
      expect(sw.hasBackgroundHandler()).toBe(false);
    });

    it('still routes a notification already on screen when the config is missing', async () => {
      const sw = loadServiceWorker({ search: '' });

      await sw.notificationClick({ type: 'member_joined', groupId: GROUP });

      expect(sw.opened).toEqual([`/tabs/group/${GROUP}`]);
    });
  });

  describe('the service worker background notification', () => {
    function actionsOf(shown: ShownNotification): Array<{ action: string; title: string }> {
      return (shown.options.actions ?? []) as Array<{ action: string; title: string }>;
    }

    it('labels the question buttons with what the API sent, localized', () => {
      const sw = loadServiceWorker();

      sw.backgroundMessage({
        data: {
          type: 'new_poll',
          title: 'Can you on Friday?',
          body: 'Vera is asking',
          yesLabel: 'I can',
          noLabel: "I can't",
        },
      });

      expect(actionsOf(sw.shown[0])).toEqual([
        { action: 'yes', title: 'I can' },
        { action: 'no', title: "I can't" },
      ]);
    });

    it('falls back to the Spanish literals when the payload carries no labels', () => {
      const sw = loadServiceWorker();

      sw.backgroundMessage({ data: { type: 'new_poll', title: '¿Puedes el viernes?' } });

      expect(actionsOf(sw.shown[0])).toEqual([
        { action: 'yes', title: 'Puedo' },
        { action: 'no', title: 'No puedo' },
      ]);
    });

    it('draws nothing at all for a widget refresh', () => {
      const sw = loadServiceWorker();

      // A widget_refresh only ever goes to android tokens, so this is belt and braces:
      // if one ever reached a browser, the worker must stay silent rather than pop a
      // notification with whatever happened to be in `data`.
      sw.backgroundMessage({ data: { type: 'widget_refresh', groupId: GROUP, title: 'nope' } });

      expect(sw.shown).toEqual([]);
    });

    it('offers no buttons for anything that is not an open question', () => {
      const sw = loadServiceWorker();

      sw.backgroundMessage({
        data: { type: 'poll_completed', title: 'El aro se cierra', yesLabel: 'I can' },
      });

      expect(sw.shown[0].options.actions).toBeUndefined();
    });
  });

  describe('the service worker window handling', () => {
    it('navigates an already-open tab instead of opening another one', async () => {
      const sw = loadServiceWorker({ clientUrls: [`${ORIGIN}/tabs/calendar`] });

      await sw.notificationClick({ type: 'member_joined', groupId: GROUP });

      expect(sw.navigated).toEqual([`/tabs/group/${GROUP}`]);
      expect(sw.opened).toEqual([]);
    });

    it('opens a window when navigating the existing tab is refused', async () => {
      const sw = loadServiceWorker({
        clientUrls: [`${ORIGIN}/tabs/calendar`],
        navigateFails: true,
      });

      await sw.notificationClick({ type: 'member_joined', groupId: GROUP });

      expect(sw.opened).toEqual([`/tabs/group/${GROUP}`]);
    });
  });
});
