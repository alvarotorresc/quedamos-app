export type EventStatus = 'pending' | 'confirmed' | 'cancelled';
export type AttendeeStatus = 'pending' | 'confirmed' | 'declined';

export interface Event {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  location?: string;
  locationLat?: number;
  locationLon?: number;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm
  endTime?: string; // HH:mm
  status: EventStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EventAttendee {
  eventId: string;
  userId: string;
  status: AttendeeStatus;
  respondedAt?: Date;
}

export interface EventWithAttendees extends Event {
  attendees: EventAttendee[];
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
}

export interface RespondEventDto {
  status: 'confirmed' | 'declined';
}
