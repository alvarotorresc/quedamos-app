/**
 * Where each push notification opens, in one table.
 *
 * There are two places that route a tapped notification and they used to disagree:
 * `navigateFromPush` (native taps + web foreground) and the `notificationclick` handler
 * in `public/firebase-messaging-sw.js` (web background). Both only knew four types, so
 * everything else — a role change, a new proposal, being kicked — landed on
 * `/tabs/plans`.
 *
 * This module is the source of truth. The service worker is a classic worker (it uses
 * `importScripts` for the Firebase compat SDK) and cannot import ES modules, so it keeps
 * a hand-copied mirror; `push-routes.test.ts` parses that mirror out of the file and
 * runs the same cases against both implementations, so a divergence fails the suite.
 *
 * This file must stay dependency-free: the parity test loads it on its own.
 */

/** The kind of screen a push opens. */
export type PushRouteTarget =
  | 'event' // a plan's card in Planes
  | 'proposal' // a proposal's card in Planes
  | 'plans' // Planes, nothing focused
  | 'poll' // Calendario, with the open question focused in the mazo
  | 'calendar' // Calendario, nothing focused
  | 'group' // one group's detail
  | 'groupList'; // the list of groups — you are not in that group any more

/**
 * Every `type` the API sends in a push payload (see the notification services in
 * apps/api/src). Anything absent falls back below to the pre-existing behaviour:
 * the plan's card when the payload carries an eventId, Planes otherwise.
 */
export const PUSH_ROUTE_TABLE: Record<string, PushRouteTarget> = {
  new_event: 'event',
  event_updated: 'event',
  event_deleted: 'event',
  event_cancelled: 'event',
  event_confirmed: 'event',
  event_declined: 'event',
  event_reminder: 'event',
  // Carries proposalId AND the eventId it became: the plan is what there is to look at.
  proposal_converted: 'event',
  new_proposal: 'proposal',
  proposal_voted: 'proposal',
  new_poll: 'poll',
  // Informational ("el aro se cierra"): the poll is already completed, so there is
  // nothing for the mazo to focus — no pollId param.
  poll_completed: 'calendar',
  weekly_availability_reminder: 'calendar',
  member_joined: 'group',
  member_left: 'group',
  role_changed: 'group',
  // You are out of that group: its detail page would 403 and its id must not be
  // remembered as "the current group".
  member_kicked: 'groupList',
  group_deleted: 'groupList',
};

export const PUSH_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface PushRoute {
  /** In-app URL to open. */
  url: string;
  target: PushRouteTarget;
  /**
   * Group to remember as "the current one", when the destination is a group you are
   * still a member of. Undefined for `groupList` targets and when no valid groupId
   * travelled in the payload.
   */
  persistGroupId?: string;
  /** Group you have just been removed from: forget it if it was the remembered one. */
  forgetGroupId?: string;
}

function validId(value: string | undefined): string | undefined {
  return typeof value === 'string' && PUSH_UUID_RE.test(value) ? value : undefined;
}

/**
 * Resolve a push payload into a destination.
 *
 * Ids are validated as UUIDs before they reach a URL or storage — the payload arrives
 * from the network and lands in `window.location.href`.
 *
 * `answer` is the id of the notification action button the user pressed ('yes' / 'no',
 * web only); it only travels for an open question, where the mazo can auto-submit it.
 */
export function resolvePushRoute(
  data: Record<string, string | undefined>,
  answer?: string,
): PushRoute {
  const groupId = validId(data.groupId);
  const eventId = validId(data.eventId);
  const proposalId = validId(data.proposalId);
  const pollId = validId(data.pollId);

  // hasOwnProperty, not a bare lookup: `type` comes off the wire and would otherwise
  // resolve inherited members ("constructor", "toString") to something that is not a
  // target at all.
  const type = data.type ?? '';
  const known = Object.prototype.hasOwnProperty.call(PUSH_ROUTE_TABLE, type);
  const target: PushRouteTarget = known ? PUSH_ROUTE_TABLE[type] : eventId ? 'event' : 'plans';

  // groupId travels in the URL as well as into localStorage because the service worker's
  // notificationclick path replicates this routing and has no access to the page's
  // storage — the URL is the only channel that reaches it. Each field validates
  // independently: garbage in one must not suppress the other.
  const params = new URLSearchParams();

  if (target === 'groupList') {
    return { url: '/tabs/group', target, forgetGroupId: groupId };
  }

  if (target === 'group') {
    return {
      url: groupId ? `/tabs/group/${groupId}` : '/tabs/group',
      target,
      persistGroupId: groupId,
    };
  }

  if (target === 'poll') {
    if (pollId) params.set('pollId', pollId);
    if (groupId) params.set('groupId', groupId);
    // Gated on pollId: an answer with no question to attach it to is inert.
    if (pollId && (answer === 'yes' || answer === 'no')) params.set('answer', answer);
    return { url: withQuery('/tabs/calendar', params), target, persistGroupId: groupId };
  }

  if (target === 'calendar') {
    if (groupId) params.set('groupId', groupId);
    return { url: withQuery('/tabs/calendar', params), target, persistGroupId: groupId };
  }

  if (target === 'event' && eventId) params.set('eventId', eventId);
  if (target === 'proposal' && proposalId) params.set('proposalId', proposalId);
  if (groupId) params.set('groupId', groupId);
  return { url: withQuery('/tabs/plans', params), target, persistGroupId: groupId };
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
