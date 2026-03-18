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
  locationLat?: number;
  locationLon?: number;
  date: string;
  time?: string;
  endTime?: string;
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
  locationLat?: number;
  locationLon?: number;
  date: string;
  time?: string;
  endTime?: string;
  attendeeIds?: string[];
}

export interface UpdateEventDto {
  title?: string;
  description?: string;
  location?: string;
  locationLat?: number;
  locationLon?: number;
  date?: string;
  time?: string;
  endTime?: string;
}

export const eventsService = {
  getAll: (groupId: string) => api.get<Event[]>(`/groups/${groupId}/events`),

  getById: (groupId: string, eventId: string) =>
    api.get<Event>(`/groups/${groupId}/events/${eventId}`),

  create: (groupId: string, data: CreateEventDto) =>
    api.post<Event>(`/groups/${groupId}/events`, data),

  respond: (groupId: string, eventId: string, status: 'confirmed' | 'declined') =>
    api.post<Event>(`/groups/${groupId}/events/${eventId}/respond`, { status }),

  update: (groupId: string, eventId: string, data: UpdateEventDto) =>
    api.patch<Event>(`/groups/${groupId}/events/${eventId}`, data),

  delete: (groupId: string, eventId: string) =>
    api.delete<{ success: boolean }>(`/groups/${groupId}/events/${eventId}`),

  cancel: (groupId: string, eventId: string) =>
    api.post<Event>(`/groups/${groupId}/events/${eventId}/cancel`, {}),
};
