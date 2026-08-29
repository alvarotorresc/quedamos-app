import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Mazo } from './Mazo';
import type { Poll } from '../services/polls';
import type { Event } from '../services/events';
import type { GroupWithMembers } from '../services/groups';

// Mock usePendingQuestions / useRespondPoll (both live in ../hooks/usePolls)
const respondPollMock = vi.fn();
let pendingQuestions: { polls: Poll[]; pendingEvents: Event[] } = { polls: [], pendingEvents: [] };
// Mutable, unlike the rest of the mock shape — needed to exercise the isSubmitting guard,
// which a statically-false isPending can never reach.
let respondPollPending = false;

vi.mock('../hooks/usePolls', () => ({
  usePendingQuestions: () => pendingQuestions,
  useRespondPoll: () => ({ mutateAsync: respondPollMock, isPending: respondPollPending }),
}));

// Mock useRespondEvent (../hooks/useEvents)
const respondEventMock = vi.fn();
vi.mock('../hooks/useEvents', () => ({
  useRespondEvent: () => ({ mutateAsync: respondEventMock, isPending: false }),
}));

// Mock useGroup (../hooks/useGroups) — only members matter for the Aro ring
let mockGroup: GroupWithMembers | undefined;
vi.mock('../hooks/useGroups', () => ({
  useGroup: () => ({ data: mockGroup }),
}));

// Overridable motion-safe flag — real default is true (reduced motion off), one test flips it
let motionSafeValue = true;
vi.mock('../lib/motion', () => ({
  spring: { gentle: {}, snappy: {}, bouncy: {} },
  useMotionSafe: () => motionSafeValue,
}));

// Mock useToast (../hooks/useToast) — asserts the mazo surfaces mutation failures instead
// of swallowing them (the whole point of the mazo is instant, visible feedback per tap).
const showErrorMock = vi.fn();
vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError: showErrorMock }),
}));

function member(userId: string, name: string, joinedAt: string) {
  return { userId, joinedAt, role: 'member', user: { id: userId, name, avatarEmoji: '😊' } };
}

function createGroup(overrides: Partial<GroupWithMembers> = {}): GroupWithMembers {
  return {
    id: 'group-1',
    name: 'Amigos',
    emoji: '👥',
    createdById: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    members: [member('user-1', 'Alvaro', '2026-01-01T00:00:00.000Z'), member('user-2', 'Misa', '2026-01-02T00:00:00.000Z')],
    ...overrides,
  };
}

function createPoll(overrides: Partial<Poll> = {}): Poll {
  return {
    id: 'p1',
    groupId: 'group-1',
    createdById: 'user-1',
    date: '2026-02-13T00:00:00.000Z',
    slot: null,
    status: 'open',
    createdAt: '2026-02-10T00:00:00.000Z',
    createdBy: { id: 'user-1', name: 'Alvaro', avatarEmoji: '😊' },
    responses: [],
    ...overrides,
  };
}

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'e1',
    groupId: 'group-1',
    title: 'Cena',
    date: '2026-02-13T00:00:00.000Z',
    status: 'pending',
    isOnline: false,
    attendees: [],
    createdBy: { id: 'user-1', name: 'Alvaro' },
    ...overrides,
  };
}

describe('Mazo', () => {
  beforeEach(() => {
    pendingQuestions = { polls: [], pendingEvents: [] };
    mockGroup = createGroup();
    motionSafeValue = true;
    respondPollPending = false;
    respondPollMock.mockReset();
    respondEventMock.mockReset();
    showErrorMock.mockReset();
    respondPollMock.mockResolvedValue(createPoll());
    respondEventMock.mockResolvedValue(createEvent());
  });

  it('muestra la pregunta del sondeo con el aro y responde con un toque', async () => {
    pendingQuestions = { polls: [createPoll({ id: 'p1' })], pendingEvents: [] };
    const onDismiss = vi.fn();

    render(<Mazo groupId="group-1" onDismiss={onDismiss} />);

    expect(screen.getByText('mazo.canYou')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('mazo.iCan'));
      await Promise.resolve();
    });

    expect(respondPollMock).toHaveBeenCalledWith({ pollId: 'p1', answer: 'yes' });
  });

  it('si la respuesta falla muestra el error comun y no avanza de pregunta', async () => {
    pendingQuestions = { polls: [createPoll({ id: 'p1' })], pendingEvents: [] };
    respondPollMock.mockRejectedValueOnce(new Error('network down'));
    const onDismiss = vi.fn();

    render(<Mazo groupId="group-1" onDismiss={onDismiss} />);

    await act(async () => {
      fireEvent.click(screen.getByText('mazo.iCan'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(showErrorMock).toHaveBeenCalledWith('common.unexpectedError');
    // Still on the same question — not advanced, not done, not dismissed.
    expect(screen.getByText('mazo.canYou')).toBeInTheDocument();
    expect(screen.queryByText('mazo.done')).not.toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('deshabilita los botones de respuesta mientras la mutación está en curso', () => {
    pendingQuestions = { polls: [createPoll({ id: 'p1' })], pendingEvents: [] };
    respondPollPending = true;
    const onDismiss = vi.fn();

    render(<Mazo groupId="group-1" onDismiss={onDismiss} />);

    expect(screen.getByText('mazo.iCan')).toBeDisabled();
    expect(screen.getByText('mazo.iCant')).toBeDisabled();
    expect(screen.getByText('mazo.unsure')).toBeDisabled();

    // Clicking a disabled button must not reach the mutation.
    fireEvent.click(screen.getByText('mazo.iCan'));
    expect(respondPollMock).not.toHaveBeenCalled();
  });

  it('con la cola vacía llama onDismiss', () => {
    pendingQuestions = { polls: [], pendingEvents: [] };
    const onDismiss = vi.fn();

    render(<Mazo groupId="group-1" onDismiss={onDismiss} />);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('«Al mapa» descarta sin responder', () => {
    pendingQuestions = { polls: [createPoll({ id: 'p1' })], pendingEvents: [] };
    const onDismiss = vi.fn();

    render(<Mazo groupId="group-1" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('mazo.toMap'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(respondPollMock).not.toHaveBeenCalled();
    expect(respondEventMock).not.toHaveBeenCalled();
  });

  it('reordena la cola para mostrar primero la pregunta de focusPollId', () => {
    const p1 = createPoll({ id: 'p1', date: '2026-02-13T00:00:00.000Z', slot: null });
    const p2 = createPoll({ id: 'p2', date: '2026-02-20T00:00:00.000Z', slot: 'Tarde' });
    pendingQuestions = { polls: [p1, p2], pendingEvents: [] };
    const onDismiss = vi.fn();

    render(<Mazo groupId="group-1" focusPollId="p2" onDismiss={onDismiss} />);

    // p2 has a slot, so it renders the "canYouSlot" key; if p1 (no slot, "canYou") were
    // shown first instead, this would fail — proving the reorder actually happened.
    expect(screen.getByText('mazo.canYouSlot')).toBeInTheDocument();
    expect(screen.queryByText('mazo.canYou')).not.toBeInTheDocument();
  });

  it('con presetAnswer envía la respuesta automáticamente sin toque', async () => {
    pendingQuestions = { polls: [createPoll({ id: 'p1' })], pendingEvents: [] };
    const onDismiss = vi.fn();

    render(<Mazo groupId="group-1" focusPollId="p1" presetAnswer="yes" onDismiss={onDismiss} />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(respondPollMock).toHaveBeenCalledWith({ pollId: 'p1', answer: 'yes' });
  });

  it('tras responder la última pregunta muestra mazo.done y luego llama onDismiss', async () => {
    vi.useFakeTimers();
    pendingQuestions = { polls: [createPoll({ id: 'p1' })], pendingEvents: [] };
    const onDismiss = vi.fn();

    render(<Mazo groupId="group-1" onDismiss={onDismiss} />);

    await act(async () => {
      fireEvent.click(screen.getByText('mazo.iCan'));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('mazo.done')).toBeInTheDocument();
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('con movimiento reducido pasa a mazo.done y descarta sin espera', async () => {
    motionSafeValue = false;
    vi.useFakeTimers();
    pendingQuestions = { polls: [createPoll({ id: 'p1' })], pendingEvents: [] };
    const onDismiss = vi.fn();

    render(<Mazo groupId="group-1" onDismiss={onDismiss} />);

    await act(async () => {
      fireEvent.click(screen.getByText('mazo.iCan'));
      await Promise.resolve();
      await Promise.resolve();
    });

    // Reduced motion uses a 0ms dwell — still scheduled via setTimeout, so the fake-timer
    // clock must tick, but it requires no *meaningful* wait unlike the 600ms spring case.
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it('con una quedada pendiente muestra ir/no ir sin la opción de "aún no sé"', async () => {
    pendingQuestions = { polls: [], pendingEvents: [createEvent({ id: 'e1' })] };
    const onDismiss = vi.fn();

    render(<Mazo groupId="group-1" onDismiss={onDismiss} />);

    expect(screen.getByText('mazo.goingQuestion')).toBeInTheDocument();
    expect(screen.getByText('mazo.going')).toBeInTheDocument();
    expect(screen.getByText('mazo.notGoing')).toBeInTheDocument();
    expect(screen.queryByText('mazo.unsure')).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByText('mazo.going'));
      await Promise.resolve();
    });

    expect(respondEventMock).toHaveBeenCalledWith({ eventId: 'e1', status: 'confirmed' });
  });
});
