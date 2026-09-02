import { Module } from '@nestjs/common';
import { WidgetController } from './widget.controller';
import { WidgetTokenService } from './widget-token.service';
import { WidgetTokenGuard } from './widget-token.guard';
import { WidgetSummaryService } from './widget-summary.service';
import { AuthModule } from '../auth/auth.module';
import { GroupsModule } from '../groups/groups.module';

@Module({
  imports: [AuthModule, GroupsModule],
  controllers: [WidgetController],
  providers: [WidgetTokenService, WidgetTokenGuard, WidgetSummaryService],
})
export class WidgetModule {}
