import { Controller, Get, Logger, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WeatherService, WeatherData } from './weather.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { GroupsService } from '../groups/groups.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { GetForecastQueryDto } from './dto/get-forecast-query.dto';
import { Throttle } from '@nestjs/throttler';

@ApiTags('Weather')
@ApiBearerAuth()
@Controller('groups/:groupId/weather')
@UseGuards(AuthGuard)
export class WeatherController {
  private readonly logger = new Logger(WeatherController.name);

  constructor(
    private weatherService: WeatherService,
    private groupsService: GroupsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async getGroupWeather(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: { id: string },
  ): Promise<WeatherData[]> {
    await this.groupsService.findById(groupId, user.id);

    const cities = await this.prisma.groupCity.findMany({
      where: { groupId },
    });

    // One external call per city, in parallel and independent of each other: a slow or
    // malformed answer for one city must not hold the request open behind the others
    // nor take the whole endpoint down with it. GroupsService caps how many cities a
    // group can have, so the fan-out is bounded.
    const settled = await Promise.allSettled(
      cities.map((city) => this.weatherService.getForecast(city.name, city.lat, city.lon)),
    );

    const results: WeatherData[] = [];
    settled.forEach((outcome, i) => {
      if (outcome.status === 'fulfilled') {
        results.push(...outcome.value);
      } else {
        this.logger.warn(`Forecast failed for ${cities[i].name}`, outcome.reason);
      }
    });

    return results;
  }

  @Get('forecast')
  @Throttle({ default: { ttl: 60000, limit: 30 } })
  async getForecast(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @CurrentUser() user: { id: string },
    @Query() query: GetForecastQueryDto,
  ): Promise<WeatherData | null> {
    await this.groupsService.findById(groupId, user.id);

    // Resolve the real city name when the coords match a saved group city.
    // The frontend sends the exact lat/lon it got from the API, so the float
    // equality match works; fall back to '' for ad-hoc coordinates.
    const city = await this.prisma.groupCity.findFirst({
      where: { groupId, lat: query.lat, lon: query.lon },
    });

    return this.weatherService.getForDate(city?.name ?? '', query.lat, query.lon, query.date);
  }
}
