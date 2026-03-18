import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WeatherService, WeatherData } from './weather.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GroupsService } from '../groups/groups.service';
import { PrismaService } from '../common/prisma/prisma.service';

@ApiTags('Weather')
@ApiBearerAuth()
@Controller('groups/:groupId/weather')
@UseGuards(AuthGuard)
export class WeatherController {
  constructor(
    private weatherService: WeatherService,
    private groupsService: GroupsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async getGroupWeather(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: { id: string },
  ): Promise<WeatherData[]> {
    await this.groupsService.findById(groupId, user.id);

    const cities = await this.prisma.groupCity.findMany({
      where: { groupId },
    });

    const results: WeatherData[] = [];
    for (const city of cities) {
      const forecast = await this.weatherService.getForecast(city.name, city.lat, city.lon);
      results.push(...forecast);
    }

    return results;
  }

  @Get('forecast')
  async getForecast(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: { id: string },
    @Query('date') date: string,
    @Query('lat') lat: string,
    @Query('lon') lon: string,
  ): Promise<WeatherData | null> {
    await this.groupsService.findById(groupId, user.id);

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date must be YYYY-MM-DD format');
    }

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      throw new BadRequestException('lat must be a number between -90 and 90');
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      throw new BadRequestException('lon must be a number between -180 and 180');
    }

    return this.weatherService.getForDate('', latNum, lonNum, date);
  }
}
