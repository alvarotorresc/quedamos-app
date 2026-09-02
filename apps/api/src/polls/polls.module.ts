import { Module } from '@nestjs/common';
import { PollsController } from './polls.controller';
import { PollsService } from './polls.service';
import { AuthModule } from '../auth/auth.module';
import { GroupsModule } from '../groups/groups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AvailabilityModule } from '../availability/availability.module';

@Module({
  imports: [AuthModule, GroupsModule, NotificationsModule, AvailabilityModule],
  controllers: [PollsController],
  providers: [PollsService],
  exports: [PollsService],
})
export class PollsModule {}
