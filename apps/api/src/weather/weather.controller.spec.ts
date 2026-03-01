import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { WeatherController } from './weather.controller';
import { WeatherService, WeatherData } from './weather.service';
import { GroupsService } from '../groups/groups.service';
import { PrismaService } from '../common/prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { createMockPrisma, createTestGroup } from '../common/test-utils';

const mockWeatherService = {
  getForecast: jest.fn(),
  getForDate: jest.fn(),
};

const mockGroupsService = {
  findById: jest.fn().mockResolvedValue(createTestGroup()),
};

const mockAuthGuard = { canActivate: jest.fn().mockReturnValue(true) };

function createWeatherData(overrides: Partial<WeatherData> = {}): WeatherData {
  return {
    city: 'Madrid',
    date: '2026-03-01',
    tempMax: 18.5,
    tempMin: 8.2,
    weatherCode: 0,
    description: 'Clear sky',
    ...overrides,
  };
}

describe('WeatherController', () => {
  let controller: WeatherController;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WeatherController],
      providers: [
        { provide: WeatherService, useValue: mockWeatherService },
        { provide: GroupsService, useValue: mockGroupsService },
        { provide: PrismaService, useValue: prisma },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    controller = module.get<WeatherController>(WeatherController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getGroupWeather', () => {
    it('should return weather for all group cities', async () => {
      const cities = [
        { id: 'city-1', groupId: 'group-1', name: 'Madrid', lat: 40.42, lon: -3.70 },
        { id: 'city-2', groupId: 'group-1', name: 'Barcelona', lat: 41.39, lon: 2.17 },
      ];
      prisma.groupCity.findMany.mockResolvedValue(cities);

      const madridForecast = [createWeatherData(), createWeatherData({ date: '2026-03-02' })];
      const barcelonaForecast = [
        createWeatherData({ city: 'Barcelona', tempMax: 16.0 }),
        createWeatherData({ city: 'Barcelona', date: '2026-03-02', tempMax: 17.0 }),
      ];

      mockWeatherService.getForecast
        .mockResolvedValueOnce(madridForecast)
        .mockResolvedValueOnce(barcelonaForecast);

      const result = await controller.getGroupWeather('group-1', { id: 'user-1' });

      expect(result).toHaveLength(4);
      expect(mockGroupsService.findById).toHaveBeenCalledWith('group-1', 'user-1');
      expect(mockWeatherService.getForecast).toHaveBeenCalledTimes(2);
      expect(mockWeatherService.getForecast).toHaveBeenCalledWith('Madrid', 40.42, -3.70);
      expect(mockWeatherService.getForecast).toHaveBeenCalledWith('Barcelona', 41.39, 2.17);
    });

    it('should return empty array when group has no cities', async () => {
      prisma.groupCity.findMany.mockResolvedValue([]);

      const result = await controller.getGroupWeather('group-1', { id: 'user-1' });

      expect(result).toEqual([]);
      expect(mockWeatherService.getForecast).not.toHaveBeenCalled();
    });
  });

  describe('getForecast', () => {
    it('should return weather for specific date and coordinates', async () => {
      const weather = createWeatherData({ date: '2026-03-15' });
      mockWeatherService.getForDate.mockResolvedValue(weather);

      const result = await controller.getForecast(
        'group-1',
        { id: 'user-1' },
        '2026-03-15',
        '40.42',
        '-3.70',
      );

      expect(result).toEqual(weather);
      expect(mockWeatherService.getForDate).toHaveBeenCalledWith('', 40.42, -3.70, '2026-03-15');
    });

    it('should return null when date is not in forecast range', async () => {
      mockWeatherService.getForDate.mockResolvedValue(null);

      const result = await controller.getForecast(
        'group-1',
        { id: 'user-1' },
        '2026-12-01',
        '40.42',
        '-3.70',
      );

      expect(result).toBeNull();
    });

    it('should throw BadRequestException for invalid date format', async () => {
      await expect(
        controller.getForecast('group-1', { id: 'user-1' }, 'invalid', '40.42', '-3.70'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for missing date', async () => {
      await expect(
        controller.getForecast('group-1', { id: 'user-1' }, '', '40.42', '-3.70'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid latitude', async () => {
      await expect(
        controller.getForecast('group-1', { id: 'user-1' }, '2026-03-15', '100', '-3.70'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-numeric latitude', async () => {
      await expect(
        controller.getForecast('group-1', { id: 'user-1' }, '2026-03-15', 'abc', '-3.70'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid longitude', async () => {
      await expect(
        controller.getForecast('group-1', { id: 'user-1' }, '2026-03-15', '40.42', '200'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-numeric longitude', async () => {
      await expect(
        controller.getForecast('group-1', { id: 'user-1' }, '2026-03-15', '40.42', 'abc'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should accept boundary coordinate values', async () => {
      mockWeatherService.getForDate.mockResolvedValue(createWeatherData());

      await controller.getForecast('group-1', { id: 'user-1' }, '2026-03-15', '90', '180');

      expect(mockWeatherService.getForDate).toHaveBeenCalledWith('', 90, 180, '2026-03-15');
    });

    it('should accept negative boundary coordinate values', async () => {
      mockWeatherService.getForDate.mockResolvedValue(createWeatherData());

      await controller.getForecast('group-1', { id: 'user-1' }, '2026-03-15', '-90', '-180');

      expect(mockWeatherService.getForDate).toHaveBeenCalledWith('', -90, -180, '2026-03-15');
    });
  });
});
