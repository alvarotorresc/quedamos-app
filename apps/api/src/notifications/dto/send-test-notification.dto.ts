import { IsOptional, IsString, MaxLength, IsIn } from 'class-validator';
import { NOTIFICATION_TYPES, NotificationType } from './update-preference.dto';

export class SendTestNotificationDto {
  @IsOptional()
  @IsString()
  @IsIn(NOTIFICATION_TYPES)
  type?: NotificationType;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  body?: string;
}
