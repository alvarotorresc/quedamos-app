import { Controller, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RegisterTokenDto } from './dto/register-token.dto';
import { UnregisterTokenDto } from './dto/unregister-token.dto';

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
}
