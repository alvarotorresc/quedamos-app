import { Controller, Get, Patch, Delete, Body, Header, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { AccountService } from './account.service';
import { AuthGuard } from './auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private accountService: AccountService,
  ) {}

  @Get('me')
  @UseGuards(AuthGuard)
  getProfile(@CurrentUser() user: { id: string }) {
    return this.authService.getProfile(user.id);
  }

  @Patch('me')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  updateProfile(@CurrentUser() user: { id: string }, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(user.id, dto);
  }

  @Delete('me')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  deleteAccount(@CurrentUser() user: { id: string }) {
    return this.accountService.deleteAccount(user.id);
  }

  @Get('me/export')
  @UseGuards(AuthGuard)
  @Throttle({ default: { ttl: 60000, limit: 3 } })
  @Header('Content-Disposition', 'attachment; filename="quedamos-export.json"')
  @Header('Cache-Control', 'no-store')
  exportData(@CurrentUser() user: { id: string }) {
    return this.accountService.exportData(user.id);
  }
}
