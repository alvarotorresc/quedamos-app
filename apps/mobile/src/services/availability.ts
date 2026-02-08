import { api } from '../lib/api';

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
  user?: {
    id: string;
    name: string;
    avatarEmoji: string;
  };
}

export interface CreateAvailabilityDto {
  date: string;
  type: AvailabilityType;
  slots?: TimeSlot[];
  startTime?: string;
  endTime?: string;
}

export const availabilityService = {
  getAll: (groupId: string) =>
    api.get<Availability[]>(`/groups/${groupId}/availability`),

  getMine: (groupId: string) =>
    api.get<Availability[]>(`/groups/${groupId}/availability/me`),

  create: (groupId: string, data: CreateAvailabilityDto) =>
    api.post<Availability>(`/groups/${groupId}/availability`, data),

  update: (groupId: string, date: string, data: CreateAvailabilityDto) =>
    api.put<Availability>(`/groups/${groupId}/availability/${date}`, data),

  delete: (groupId: string, date: string) =>
    api.delete<{ success: boolean }>(`/groups/${groupId}/availability/${date}`),
};
