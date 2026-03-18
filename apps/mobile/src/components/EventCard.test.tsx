import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventCard } from './EventCard';
import type { Event } from '../services/events';

// Mock hooks
const mockMutate = vi.fn();
vi.mock('../hooks/useEvents', () => ({
  useRespondEvent: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
}));

// Mock auth store — default: user-1
let mockUserId = 'user-1';
vi.mock('../stores/auth', () => ({
  useAuthStore: vi.fn((selector: (s: { user: { id: string } }) => unknown) =>
    selector({ user: { id: mockUserId } }),
  ),
}));

// Mock Ionic
vi.mock('@ionic/react', () => ({
  IonSpinner: ({ className }: { className?: string }) => (
    <span data-testid="spinner" className={className} />
  ),
}));

// Mock react-icons
vi.mock('react-icons/hi2', () => ({
  HiOutlineMapPin: () => <span data-testid="icon-map" />,
  HiOutlineClock: () => <span data-testid="icon-clock" />,
  HiOutlinePencil: () => <span data-testid="icon-pencil" />,
}));

// Mock WeatherWidget
vi.mock('./WeatherWidget', () => ({
  WeatherBadge: () => <span data-testid="weather-badge" />,
  getWeatherIcon: () => '☀️',
  getWeatherDescKey: () => 'weather.desc.clear',
}));

// Helpers

const CURRENT_USER_ID = 'user-1';
const OTHER_USER_ID = 'user-2';
const CREATOR_ID = 'user-3';

function createEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'event-1',
    groupId: 'group-1',
    title: 'Cena en el centro',
    date: '2026-04-15',
    status: 'pending',
    attendees: [],
    createdBy: { id: CREATOR_ID, name: 'Creator' },
    ...overrides,
  };
}

function createAttendee(
  userId: string,
  status: 'pending' | 'confirmed' | 'declined',
  name = 'User',
) {
  return {
    userId,
    status,
    user: { id: userId, name, avatarEmoji: '😊' },
  };
}

const defaultProps = {
  groupId: 'group-1',
  memberColorMap: new Map<string, string>([
    [CURRENT_USER_ID, '#60A5FA'],
    [OTHER_USER_ID, '#F59E0B'],
    [CREATOR_ID, '#34D399'],
  ]),
};

describe('EventCard', () => {
  beforeEach(() => {
    mockUserId = CURRENT_USER_ID;
    vi.clearAllMocks();
  });

  // --- Test 1: Invited user with pending status sees confirm/decline buttons ---

  it('should show confirm and decline buttons when user is invited with pending status', () => {
    const event = createEvent({
      attendees: [
        createAttendee(CURRENT_USER_ID, 'pending', 'Alvaro'),
        createAttendee(OTHER_USER_ID, 'confirmed', 'Misa'),
      ],
    });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.getByText('plans.confirm')).toBeInTheDocument();
    expect(screen.getByText('plans.decline')).toBeInTheDocument();
  });

  // --- Test 2: Non-invited user does NOT see confirm/decline buttons ---

  it('should not show confirm or decline buttons when user is not in attendees', () => {
    const event = createEvent({
      attendees: [
        createAttendee(OTHER_USER_ID, 'pending', 'Misa'),
        createAttendee(CREATOR_ID, 'confirmed', 'Creator'),
      ],
    });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.queryByText('plans.confirm')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.decline')).not.toBeInTheDocument();
  });

  // --- Test 3: Invited user with confirmed status sees status badge, NOT pending buttons ---

  it('should show confirmed status button and not show pending buttons when user has confirmed', () => {
    const event = createEvent({
      attendees: [
        createAttendee(CURRENT_USER_ID, 'confirmed', 'Alvaro'),
        createAttendee(OTHER_USER_ID, 'pending', 'Misa'),
      ],
    });

    render(<EventCard event={event} {...defaultProps} />);

    // Should NOT see the pending confirm/decline buttons
    expect(screen.queryByText('plans.confirm')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.decline')).not.toBeInTheDocument();

    // Should see the confirmed status text
    expect(screen.getByText('plans.youConfirmed')).toBeInTheDocument();
  });

  // --- Additional edge case tests ---

  it('should not show respond buttons when user is not invited and event has no attendees', () => {
    const event = createEvent({
      attendees: [],
    });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.queryByText('plans.confirm')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.decline')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.youConfirmed')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.youDeclined')).not.toBeInTheDocument();
  });

  it('should show declined status button when user has declined', () => {
    const event = createEvent({
      attendees: [createAttendee(CURRENT_USER_ID, 'declined', 'Alvaro')],
    });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.queryByText('plans.confirm')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.decline')).not.toBeInTheDocument();
    expect(screen.getByText('plans.youDeclined')).toBeInTheDocument();
  });

  it('should not show respond buttons when event is cancelled even if user is pending', () => {
    const event = createEvent({
      status: 'cancelled',
      attendees: [createAttendee(CURRENT_USER_ID, 'pending', 'Alvaro')],
    });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.queryByText('plans.confirm')).not.toBeInTheDocument();
    expect(screen.queryByText('plans.decline')).not.toBeInTheDocument();
  });

  it('should render event title and date', () => {
    const event = createEvent({ title: 'Partido de padel' });

    render(<EventCard event={event} {...defaultProps} />);

    expect(screen.getByText('Partido de padel')).toBeInTheDocument();
  });

  it('should show attendee counts', () => {
    const event = createEvent({
      attendees: [
        createAttendee(CURRENT_USER_ID, 'confirmed', 'Alvaro'),
        createAttendee(OTHER_USER_ID, 'confirmed', 'Misa'),
        createAttendee(CREATOR_ID, 'declined', 'Creator'),
      ],
    });

    render(<EventCard event={event} {...defaultProps} />);

    // 2 confirmed out of 3 total
    expect(screen.getByText('2/3')).toBeInTheDocument();
    // 1 declined out of 3 total
    expect(screen.getByText('1/3')).toBeInTheDocument();
  });
});
