import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AuthModule } from '../auth/auth.module';
import { GroupsModule } from '../groups/groups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WidgetRefreshModule } from '../widget-refresh/widget-refresh.module';

@Module({
  imports: [AuthModule, GroupsModule, NotificationsModule, WidgetRefreshModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
