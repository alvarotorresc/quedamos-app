import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MazoGate } from './MazoGate';
import type { Poll } from '../services/polls';
import type { Event } from '../services/events';
import type { GroupWithMembers } from '../services/groups';

// Same mocking shape as Mazo.test.tsx — MazoGate renders the real (unmocked) Mazo, so
// both components read from these same mutable fixtures, exactly like two components
// independently subscribed to the same react-query cache would in production.
const respondPollMock = vi.fn();
let pendingQuestions: { polls: Poll[]; pendingEvents: Event[] } = { polls: [], pendingEvents: [] };
let pollsLoading = false;
let eventsLoading = false;

vi.mock('../hooks/usePolls', () => ({
  usePendingQuestions: () => pendingQuestions,
  usePolls: () => ({ isLoading: pollsLoading }),
  useRespondPoll: () => ({ mutateAsync: respondPollMock, isPending: false }),
}));

const respondEventMock = vi.fn();
vi.mock('../hooks/useEvents', () => ({
  useEvents: () => ({ isLoading: eventsLoading }),
  useRespondEvent: () => ({ mutateAsync: respondEventMock, isPending: false }),
}));

let mockGroup: GroupWithMembers | undefined;
vi.mock('../hooks/useGroups', () => ({
  useGroup: () => ({ data: mockGroup }),
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn() }),
}));

function member(userId: string, name: string, joinedAt: string) {
  return { userId, joinedAt, role: 'member', user: { id: userId, name, avatarEmoji: '😊' } };
}

function createGroup(): GroupWithMembers {
  return {
    id: 'group-1',
    name: 'Amigos',
    emoji: '👥',
    createdById: 'user-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    members: [member('user-1', 'Alvaro', '2026-01-01T00:00:00.000Z')],
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

describe('MazoGate', () => {
  beforeEach(() => {
    pendingQuestions = { polls: [], pendingEvents: [] };
    pollsLoading = false;
    eventsLoading = false;
    mockGroup = createGroup();
    respondPollMock.mockReset();
    respondEventMock.mockReset();
    respondPollMock.mockResolvedValue(createPoll());
  });

  it('no monta el mazo mientras las queries están cargando, aunque ya haya pendientes', () => {
    pollsLoading = true;
    pendingQuestions = { polls: [createPoll()], pendingEvents: [] };

    render(<MazoGate groupId="group-1" />);

    expect(screen.queryByText('mazo.canYou')).not.toBeInTheDocument();
  });

  it('monta el mazo cuando hay preguntas pendientes y las queries han resuelto', () => {
    pendingQuestions = { polls: [createPoll()], pendingEvents: [] };

    render(<MazoGate groupId="group-1" />);

    expect(screen.getByText('mazo.canYou')).toBeInTheDocument();
  });

  it('no monta nada si no hay preguntas pendientes', () => {
    pendingQuestions = { polls: [], pendingEvents: [] };

    render(<MazoGate groupId="group-1" />);

    expect(screen.queryByText('mazo.canYou')).not.toBeInTheDocument();
  });

  // The critical fix: answering the last question invalidates the polls query (react-query's
  // own onSuccess plus the realtime broadcastSync re-invalidation), which routinely resolves
  // well inside the 600ms done-dwell. Before this fix, the parent re-evaluated its mount
  // condition against that now-empty live data and unmounted <Mazo> mid-dwell — "Ya está."
  // never showed, and onDismiss (which Task 7's deep-link cleanup depends on) never fired
  // because the dwell effect was torn down first.
  it('un refetch que vacía la cola a mitad del dwell no desmonta el mazo antes de su propio cierre', async () => {
    vi.useFakeTimers();
    pendingQuestions = { polls: [createPoll({ id: 'p1' })], pendingEvents: [] };
    respondPollMock.mockImplementation(async () => {
      // Simulate the real invalidate+refetch collapsing the live pending list to zero —
      // exactly the race that used to unmount Mazo before its own onDismiss ran.
      pendingQuestions = { polls: [], pendingEvents: [] };
      return createPoll();
    });

    const { rerender } = render(<MazoGate groupId="group-1" />);

    await act(async () => {
      fireEvent.click(screen.getByText('mazo.iCan'));
      await Promise.resolve();
      await Promise.resolve();
    });

    // Force MazoGate to re-render and re-read the now-empty pendingQuestions, exactly as a
    // component subscribed to a freshly-invalidated query would be pushed a re-render.
    rerender(<MazoGate groupId="group-1" />);

    // The done beat must still be visible — the open latch must not have flipped off just
    // because the live pending count dropped to zero mid-dwell.
    expect(screen.getByText('mazo.done')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Only the dwell timeout (Mazo's own onDismiss) closes it — it does, and unmounts.
    expect(screen.queryByText('mazo.done')).not.toBeInTheDocument();
    expect(screen.queryByText('mazo.canYou')).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it('pasa focusPollId/presetAnswer al mazo, que auto-responde la pregunta enfocada', async () => {
    pendingQuestions = { polls: [createPoll({ id: 'p1' })], pendingEvents: [] };

    render(<MazoGate groupId="group-1" focusPollId="p1" presetAnswer="yes" />);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(respondPollMock).toHaveBeenCalledWith({ pollId: 'p1', answer: 'yes' });
  });

  it('llama la prop onDismiss cuando el mazo se cierra', () => {
    pendingQuestions = { polls: [createPoll({ id: 'p1' })], pendingEvents: [] };
    const onDismiss = vi.fn();

    render(<MazoGate groupId="group-1" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('mazo.toMap'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('un nuevo focusPollId reabre el mazo aunque ya se hubiera descartado en esta sesión', () => {
    pendingQuestions = { polls: [createPoll({ id: 'p1' }), createPoll({ id: 'p2' })], pendingEvents: [] };

    const { rerender } = render(<MazoGate groupId="group-1" />);
    fireEvent.click(screen.getByText('mazo.toMap'));
    expect(screen.queryByText('mazo.canYou')).not.toBeInTheDocument();

    // A fresh deep link arrives for a different poll while still on the same group —
    // the latch must reopen even though it was just dismissed.
    rerender(<MazoGate groupId="group-1" focusPollId="p2" />);

    expect(screen.getByText('mazo.canYou')).toBeInTheDocument();
  });

  it('tras un cambio de grupo se reevalúa desde cero (no arrastra el cierre del grupo anterior)', () => {
    pendingQuestions = { polls: [createPoll({ id: 'p1' })], pendingEvents: [] };
    const { rerender } = render(<MazoGate groupId="group-1" />);

    fireEvent.click(screen.getByText('mazo.toMap'));
    expect(screen.queryByText('mazo.canYou')).not.toBeInTheDocument();

    // Switch to a different group that also has a pending poll — must open again, even
    // though the previous group's mazo was just dismissed.
    pendingQuestions = { polls: [createPoll({ id: 'p2' })], pendingEvents: [] };
    rerender(<MazoGate groupId="group-2" />);

    expect(screen.getByText('mazo.canYou')).toBeInTheDocument();
  });
});
