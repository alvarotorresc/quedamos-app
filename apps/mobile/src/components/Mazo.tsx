import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { HiOutlineArrowRight } from 'react-icons/hi2';
import { Aro, type AroMember } from '../ui/Aro';
import { Button } from '../ui/Button';
import { useGroup } from '../hooks/useGroups';
import { usePendingQuestions, useRespondPoll } from '../hooks/usePolls';
import { useRespondEvent } from '../hooks/useEvents';
import { useToast } from '../hooks/useToast';
import { buildMemberColorMap } from '../lib/member-colors';
import { MEMBER_COLORS } from '../lib/constants';
import { apiDateToKey, parseDateKey } from '../lib/date-utils';
import { spring, useMotionSafe } from '../lib/motion';
import { SLOT_KEYS } from '../lib/availability-label';
import type { GroupMember } from '../services/groups';
import type { Poll } from '../services/polls';
import type { Event } from '../services/events';

export interface MazoProps {
  groupId: string;
  focusPollId?: string | null;
  presetAnswer?: 'yes' | 'no' | null;
  onDismiss: () => void;
}

type MazoQuestion =
  | { kind: 'poll'; id: string; poll: Poll }
  | { kind: 'event'; id: string; event: Event };

const DONE_DWELL_MS = 600;

// The wordmark mark is the app's abstract six-color ring — it always shows all six
// canonical member colors "on", regardless of the current group's actual members.
const WORDMARK_MEMBERS: AroMember[] = MEMBER_COLORS.map((color) => ({ color, state: 'on' }));

function questionKey(q: MazoQuestion): string {
  return `${q.kind}:${q.id}`;
}

function questionDateKey(q: MazoQuestion): string {
  return apiDateToKey(q.kind === 'poll' ? q.poll.date : q.event.date);
}

/**
 * Builds the ordered question queue once, from the pending polls/events snapshot at
 * mount time (chronological, polls before events on same-day ties). If `focusPollId`
 * matches a poll in the queue, that poll is moved to the front — used by deep links
 * from a push notification (Task 7) to open the mazo already on that question.
 */
function buildQueue(polls: Poll[], events: Event[], focusPollId: string | null): MazoQuestion[] {
  const items: MazoQuestion[] = [
    ...polls.map((poll) => ({ kind: 'poll' as const, id: poll.id, poll })),
    ...events.map((event) => ({ kind: 'event' as const, id: event.id, event })),
  ];

  items.sort((a, b) => {
    const dateDiff = questionDateKey(a).localeCompare(questionDateKey(b));
    if (dateDiff !== 0) return dateDiff;
    if (a.kind !== b.kind) return a.kind === 'poll' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  if (!focusPollId) return items;
  const focusIndex = items.findIndex((q) => q.kind === 'poll' && q.id === focusPollId);
  if (focusIndex <= 0) return items;

  const reordered = [...items];
  const [focused] = reordered.splice(focusIndex, 1);
  reordered.unshift(focused);
  return reordered;
}

/**
 * Aro states for every group member on the current question — spec: `on` = answered
 * yes / confirmed, `apagado` = answered no / unsure / declined, `off` = no response yet.
 */
function memberStates(
  q: MazoQuestion,
  members: GroupMember[],
  colorMap: Map<string, string>,
): AroMember[] {
  if (q.kind === 'poll') {
    const answers = new Map(q.poll.responses.map((r) => [r.userId, r.answer]));
    return members.map((m) => {
      const color = colorMap.get(m.userId) ?? MEMBER_COLORS[0];
      const answer = answers.get(m.userId);
      if (answer === 'yes') return { color, state: 'on' };
      if (answer === 'no' || answer === 'unsure') return { color, state: 'apagado' };
      return { color, state: 'off' };
    });
  }

  const statuses = new Map(q.event.attendees.map((a) => [a.userId, a.status]));
  return members.map((m) => {
    const color = colorMap.get(m.userId) ?? MEMBER_COLORS[0];
    const status = statuses.get(m.userId);
    if (status === 'confirmed') return { color, state: 'on' };
    if (status === 'declined') return { color, state: 'apagado' };
    return { color, state: 'off' };
  });
}

export function Mazo({ groupId, focusPollId = null, presetAnswer = null, onDismiss }: MazoProps) {
  const { t, i18n } = useTranslation();
  const motionSafe = useMotionSafe();
  const locale = i18n.language === 'es' ? 'es-ES' : 'en-US';

  const { polls, pendingEvents } = usePendingQuestions(groupId);
  const { data: groupDetail } = useGroup(groupId);
  const members = useMemo(() => groupDetail?.members ?? [], [groupDetail]);
  const memberColorMap = useMemo(() => buildMemberColorMap(members), [members]);

  const respondPoll = useRespondPoll(groupId);
  const respondEvent = useRespondEvent(groupId);
  const { showError } = useToast();

  // Snapshot the queue once at mount — usePendingQuestions re-derives from the query
  // cache, and each answer invalidates it, which would otherwise shrink the array and
  // shift indices under us mid-transition (see task report for details).
  const [queue] = useState<MazoQuestion[]>(() => buildQueue(polls, pendingEvents, focusPollId));
  const [index, setIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const presetFired = useRef(false);

  const total = queue.length;
  const current = index < total ? queue[index] : null;
  const isSubmitting = respondPoll.isPending || respondEvent.isPending;

  // Empty deck is the reward: nothing pending means straight through to the map.
  useEffect(() => {
    if (total === 0) onDismiss();
  }, [total, onDismiss]);

  useEffect(() => {
    if (total > 0 && index >= total) setIsDone(true);
  }, [index, total]);

  useEffect(() => {
    if (!isDone) return;
    const delay = motionSafe ? DONE_DWELL_MS : 0;
    const timer = setTimeout(onDismiss, delay);
    return () => clearTimeout(timer);
  }, [isDone, motionSafe, onDismiss]);

  // Deep-link auto-answer (Task 7 wires the URL params that produce these props): if the
  // focused question arrived with a preset answer, submit it once without a second tap.
  useEffect(() => {
    if (presetFired.current) return;
    if (!current || current.kind !== 'poll' || !presetAnswer) return;
    if (current.poll.id !== focusPollId) return;
    presetFired.current = true;
    respondPoll
      .mutateAsync({ pollId: current.poll.id, answer: presetAnswer })
      .then(() => setIndex((i) => i + 1))
      .catch(() => {
        presetFired.current = false;
        showError('common.unexpectedError');
      });
    // respondPoll is a fresh object each render; presetFired guards re-firing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, presetAnswer, focusPollId]);

  if (total === 0) return null;

  const handlePollAnswer = async (pollId: string, answer: 'yes' | 'no' | 'unsure') => {
    try {
      await respondPoll.mutateAsync({ pollId, answer });
      setIndex((i) => i + 1);
    } catch {
      // Keep the question on screen so the user can retry.
      showError('common.unexpectedError');
    }
  };

  const handleEventAnswer = async (eventId: string, status: 'confirmed' | 'declined') => {
    try {
      await respondEvent.mutateAsync({ eventId, status });
      setIndex((i) => i + 1);
    } catch {
      // Keep the question on screen so the user can retry.
      showError('common.unexpectedError');
    }
  };

  const ring = current ? memberStates(current, members, memberColorMap) : [];
  const answeredCount = ring.filter((m) => m.state !== 'off').length;
  const remaining = Math.max(total - index, 0);

  const weekday = current
    ? parseDateKey(questionDateKey(current)).toLocaleDateString(locale, { weekday: 'long' })
    : '';

  const eyebrow = current
    ? (() => {
        const longDate = parseDateKey(questionDateKey(current)).toLocaleDateString(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        });
        if (current.kind === 'poll' && current.poll.slot) {
          return `${longDate} · ${t(SLOT_KEYS[current.poll.slot] ?? current.poll.slot)}`;
        }
        if (current.kind === 'event' && current.event.time) {
          return `${longDate} · ${current.event.time}`;
        }
        return longDate;
      })()
    : '';

  const heading = current
    ? current.kind === 'poll'
      ? current.poll.slot
        ? t('mazo.canYouSlot', {
            weekday,
            slot: t(SLOT_KEYS[current.poll.slot] ?? current.poll.slot),
          })
        : t('mazo.canYou', { weekday })
      : t('mazo.goingQuestion', { title: current.event.title })
    : '';

  const authorName = current
    ? current.kind === 'poll'
      ? current.poll.createdBy.name
      : current.event.createdBy.name
    : '';

  return (
    <div className="fixed inset-0 z-30 bg-bg flex flex-col px-6 pt-14 pb-9">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Aro size={18} members={WORDMARK_MEMBERS} aria-hidden="true" />
          <span className="font-mono text-[11px] font-bold tracking-[0.22em] text-text-muted">
            QUEDAMOS
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="flex items-center gap-1 text-sm font-semibold text-text-muted"
        >
          {t('mazo.toMap')}
          <HiOutlineArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-2 min-h-0" aria-live="polite">
        <AnimatePresence mode="wait">
          {isDone ? (
            <motion.p
              key="done"
              initial={motionSafe ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              transition={spring.gentle}
              className="text-2xl font-extrabold text-text text-center"
            >
              {t('mazo.done')}
            </motion.p>
          ) : current ? (
            <motion.div
              key={questionKey(current)}
              initial={motionSafe ? { opacity: 0, y: 12 } : false}
              animate={{ opacity: 1, y: 0 }}
              exit={motionSafe ? { opacity: 0, y: -12 } : undefined}
              transition={spring.gentle}
              className="flex flex-col items-center gap-2 w-full"
            >
              <p className="font-mono text-[11px] font-medium tracking-[0.2em] uppercase text-text-muted">
                {eyebrow}
              </p>
              <h1 className="text-4xl font-extrabold text-center tracking-tight leading-tight max-w-xs mt-1 mb-2.5 text-text">
                {heading}
              </h1>

              <Aro size={200} members={ring}>
                <span className="font-sans text-[26px] font-extrabold text-text">
                  {answeredCount}/{members.length}
                </span>
              </Aro>

              <p className="h-5 text-sm font-semibold text-text-muted mt-2">
                {t('mazo.asks', { name: authorName })}
              </p>

              <div className="flex flex-col gap-2.5 w-full max-w-xs mt-2.5">
                {current.kind === 'poll' ? (
                  <>
                    <div className="flex gap-2.5">
                      <Button
                        variant="primary"
                        className="flex-1"
                        disabled={isSubmitting}
                        onClick={() => handlePollAnswer(current.poll.id, 'yes')}
                      >
                        {t('mazo.iCan')}
                      </Button>
                      <Button
                        variant="secondary"
                        className="flex-1"
                        disabled={isSubmitting}
                        onClick={() => handlePollAnswer(current.poll.id, 'no')}
                      >
                        {t('mazo.iCant')}
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      disabled={isSubmitting}
                      onClick={() => handlePollAnswer(current.poll.id, 'unsure')}
                    >
                      {t('mazo.unsure')}
                    </Button>
                  </>
                ) : (
                  <div className="flex gap-2.5">
                    <Button
                      variant="primary"
                      className="flex-1"
                      disabled={isSubmitting}
                      onClick={() => handleEventAnswer(current.event.id, 'confirmed')}
                    >
                      {t('mazo.going')}
                    </Button>
                    <Button
                      variant="secondary"
                      className="flex-1"
                      disabled={isSubmitting}
                      onClick={() => handleEventAnswer(current.event.id, 'declined')}
                    >
                      {t('mazo.notGoing')}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>

      {!isDone && (
        <div className="flex flex-col items-center gap-2.5 shrink-0">
          <div className="flex gap-1.5">
            {queue.map((q, i) => (
              <span
                key={questionKey(q)}
                className={`w-1.5 h-1.5 rounded-full transition-transform ${
                  i === index ? 'bg-primary-solid scale-125' : 'bg-text-dark/40'
                }`}
              />
            ))}
          </div>
          <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-text-muted">
            {t('mazo.pending', { count: remaining })}
          </p>
        </div>
      )}
    </div>
  );
}

export default Mazo;
