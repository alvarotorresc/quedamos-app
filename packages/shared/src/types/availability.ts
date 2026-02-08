export type AvailabilityType = 'day' | 'slots' | 'range';

export type TimeSlot = 'Mañana' | 'Tarde' | 'Noche';

export interface Availability {
  id: string;
  userId: string;
  groupId: string;
  date: string; // YYYY-MM-DD
  type: AvailabilityType;
  slots?: TimeSlot[];
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  createdAt: Date;
}

export interface CreateAvailabilityDto {
  date: string;
  type: AvailabilityType;
  slots?: TimeSlot[];
  startTime?: string;
  endTime?: string;
}

export interface UpdateAvailabilityDto extends CreateAvailabilityDto {}

export interface DayScore {
  date: string;
  score: number;
  availableCount: number;
  totalMembers: number;
}
