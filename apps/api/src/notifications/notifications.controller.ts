import {
  Controller,
  Post,
  Delete,
  Get,
  Put,
  Body,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RegisterTokenDto } from './dto/register-token.dto';
import { UnregisterTokenDto } from './dto/unregister-token.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';
import { SendTestNotificationDto } from './dto/send-test-notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('register-token')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  registerToken(@CurrentUser() user: { id: string }, @Body() dto: RegisterTokenDto) {
    return this.notificationsService.registerToken(user.id, dto);
  }

  @Delete('unregister-token')
  unregisterToken(@CurrentUser() user: { id: string }, @Body() dto: UnregisterTokenDto) {
    return this.notificationsService.unregisterToken(user.id, dto.token);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: { id: string }) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Put('preferences')
  updatePreference(@CurrentUser() user: { id: string }, @Body() dto: UpdatePreferenceDto) {
    return this.notificationsService.updatePreference(user.id, dto);
  }

  @Post('test')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  sendTestNotification(@CurrentUser() user: { id: string }, @Body() dto: SendTestNotificationDto) {
    return this.notificationsService.sendTestNotification(user.id, dto);
  }

  /**
   * Diagnostic dump of the caller's push tokens. Hidden in production unless
   * ENABLE_NOTIFICATIONS_DEBUG=true, so the route never becomes a data probe.
   */
  @Get('debug')
  async getDebugInfo(@CurrentUser() user: { id: string }) {
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ENABLE_NOTIFICATIONS_DEBUG !== 'true'
    ) {
      throw new NotFoundException();
    }
    return this.notificationsService.getDebugInfo(user.id);
  }
}
