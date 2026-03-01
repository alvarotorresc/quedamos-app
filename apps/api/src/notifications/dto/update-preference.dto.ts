import { IsString, IsBoolean, IsIn } from 'class-validator';

export const NOTIFICATION_TYPES = [
  // Events
  'new_event',
  'event_updated',
  'event_deleted',
  'event_cancelled',
  'event_confirmed',
  'event_declined',
  'event_reminder',
  // Proposals
  'new_proposal',
  'proposal_voted',
  'proposal_converted',
  // Members
  'member_joined',
  'member_left',
  'role_changed',
  'member_kicked',
  'group_deleted',
  // Reminders
  'weekly_availability_reminder',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export class UpdatePreferenceDto {
  @IsString()
  @IsIn(NOTIFICATION_TYPES)
  type: NotificationType;

  @IsBoolean()
  enabled: boolean;
}
