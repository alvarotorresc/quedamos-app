import { Controller, Get, Post, Delete, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { WidgetTokenService } from './widget-token.service';
import { WidgetTokenGuard } from './widget-token.guard';
import { WidgetSummaryService } from './widget-summary.service';
import { GetWidgetSummaryQueryDto } from './dto/get-widget-summary-query.dto';

@ApiTags('Widget')
@Controller('widget')
export class WidgetController {
  constructor(
    private widgetTokenService: WidgetTokenService,
    private widgetSummaryService: WidgetSummaryService,
  ) {}

  @Post('token')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  issueToken(@CurrentUser() user: { id: string }) {
    return this.widgetTokenService.issue(user.id);
  }

  @Delete('token')
  @ApiBearerAuth()
  @UseGuards(AuthGuard)
  revokeTokens(@CurrentUser() user: { id: string }) {
    return this.widgetTokenService.revokeAll(user.id);
  }

  @Get('summary')
  @UseGuards(WidgetTokenGuard)
  getSummary(@CurrentUser() user: { id: string }, @Query() query: GetWidgetSummaryQueryDto) {
    return this.widgetSummaryService.getSummary(
      user.id,
      query.groupId,
      query.weekStart,
      query.today,
    );
  }
}
