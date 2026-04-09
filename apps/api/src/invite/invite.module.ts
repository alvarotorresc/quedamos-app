import { Module } from '@nestjs/common';
import { InviteController } from './invite.controller';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [GroupsModule],
  controllers: [InviteController],
})
export class InviteModule {}
