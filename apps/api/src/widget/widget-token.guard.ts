import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { WidgetTokenService } from './widget-token.service';

@Injectable()
export class WidgetTokenGuard implements CanActivate {
  constructor(private widgetTokenService: WidgetTokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing authorization header');
    }

    const user = await this.widgetTokenService.validate(authHeader.substring(7));
    if (!user) {
      throw new UnauthorizedException('Invalid widget token');
    }

    request.user = user;
    return true;
  }
}
