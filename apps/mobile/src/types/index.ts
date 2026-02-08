export interface User {
  id: string;
  email: string;
  name: string;
  avatarEmoji: string;
}

export interface Group {
  id: string;
  name: string;
  emoji: string;
  inviteCode: string;
}

export type AvailabilityType = 'day' | 'slots' | 'range';
export type TimeSlot = 'Mañana' | 'Tarde' | 'Noche';

export interface Availability {
  id: string;
  userId: string;
  groupId: string;
  date: string;
  type: AvailabilityType;
  slots?: TimeSlot[];
  startTime?: string;
  endTime?: string;
}

export type EventStatus = 'pending' | 'confirmed' | 'cancelled';
export type AttendeeStatus = 'pending' | 'confirmed' | 'declined';

export interface Event {
  id: string;
  groupId: string;
  title: string;
  description?: string;
  location?: string;
  date: string;
  time?: string;
  status: EventStatus;
}
