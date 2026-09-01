import type { UpdateEventDto } from '../services/events';

export interface EventEditFormState {
  title: string;
  location: string;
  time: string;
  endTime: string;
  description: string;
  isOnline: boolean;
  meetingUrl: string;
}

/**
 * Builds the PATCH payload for editing an event. Cleared optional fields are
 * sent as null (NOT '' — the backend DTO rejects '' via @Matches/@MinLength;
 * @IsOptional only skips validation for null/undefined). time and endTime are
 * always sent together so an event never ends up with an end and no start:
 * clearing the start also clears the end, even if the end field itself still
 * holds a value.
 */
export function buildEventEditPayload(s: EventEditFormState): UpdateEventDto {
  const hasStart = !!s.time;
  const payload: UpdateEventDto = {
    title: s.title.trim(),
    isOnline: s.isOnline,
    location: !s.isOnline && s.location.trim() ? s.location.trim() : null,
    description: s.description.trim() ? s.description.trim() : null,
    time: hasStart ? s.time : null,
    endTime: hasStart && s.endTime ? s.endTime : null,
  };
  if (s.isOnline) {
    payload.meetingUrl = s.meetingUrl.trim() ? s.meetingUrl.trim() : null;
  }
  return payload;
}
