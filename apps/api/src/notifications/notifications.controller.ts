import { Controller, Post, Delete, Get, Put, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RegisterTokenDto } from './dto/register-token.dto';
import { UnregisterTokenDto } from './dto/unregister-token.dto';
import { UpdatePreferenceDto } from './dto/update-preference.dto';

@Controller('notifications')
@UseGuards(AuthGuard)
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Post('register-token')
  registerToken(
    @CurrentUser() user: { id: string },
    @Body() dto: RegisterTokenDto,
  ) {
    return this.notificationsService.registerToken(user.id, dto);
  }

  @Delete('unregister-token')
  unregisterToken(
    @CurrentUser() user: { id: string },
    @Body() dto: UnregisterTokenDto,
  ) {
    return this.notificationsService.unregisterToken(user.id, dto.token);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: { id: string }) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Put('preferences')
  updatePreference(
    @CurrentUser() user: { id: string },
    @Body() dto: UpdatePreferenceDto,
  ) {
    return this.notificationsService.updatePreference(user.id, dto);
  }
}
