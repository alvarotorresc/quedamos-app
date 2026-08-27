import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications/notifications.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  check(): { status: string; firebaseInitialized: boolean } {
    return {
      status: 'ok',
      firebaseInitialized: this.notificationsService.isFirebaseInitialized(),
    };
  }
}
