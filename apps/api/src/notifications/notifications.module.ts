import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { EventReminderService } from './event-reminder.service';
import { WeeklyReminderService } from './weekly-reminder.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, EventReminderService, WeeklyReminderService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
