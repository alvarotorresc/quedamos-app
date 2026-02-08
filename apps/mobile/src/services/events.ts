import { api } from '../lib/api';

export type EventStatus = 'pending' | 'confirmed' | 'cancelled';
export type AttendeeStatus = 'pending' | 'confirmed' | 'declined';

export interface EventAttendee {
  userId: string;
  status: AttendeeStatus;
  respondedAt?: string;
  user: {
    id: string;
    name: string;
    avatarEmoji: string;
  };
}

export interface Event {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  location?: string;
  date: string;
  time?: string;
  status: EventStatus;
  attendees: EventAttendee[];
  createdBy: {
    id: string;
    name: string;
  };
}

export interface CreateEventDto {
  title: string;
  description?: string;
  location?: string;
  date: string;
  time?: string;
}

export const eventsService = {
  getAll: (groupId: string) =>
    api.get<Event[]>(`/groups/${groupId}/events`),

  getById: (groupId: string, eventId: string) =>
    api.get<Event>(`/groups/${groupId}/events/${eventId}`),

  create: (groupId: string, data: CreateEventDto) =>
    api.post<Event>(`/groups/${groupId}/events`, data),

  respond: (groupId: string, eventId: string, status: 'confirmed' | 'declined') =>
    api.post<Event>(`/groups/${groupId}/events/${eventId}/respond`, { status }),
};
