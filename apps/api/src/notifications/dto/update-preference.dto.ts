import { IsString, IsBoolean, IsIn } from 'class-validator';

const NOTIFICATION_TYPES = [
  'new_event',
  'event_confirmed',
  'event_declined',
  'member_joined',
  'member_left',
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export class UpdatePreferenceDto {
  @IsString()
  @IsIn(NOTIFICATION_TYPES)
  type: NotificationType;

  @IsBoolean()
  enabled: boolean;
}
