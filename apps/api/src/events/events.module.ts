import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { AuthModule } from '../auth/auth.module';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [AuthModule, GroupsModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
