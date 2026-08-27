import { WeatherService } from './weather.service';

const mockOpenMeteoResponse = {
  daily: {
    time: ['2026-03-01', '2026-03-02', '2026-03-03'],
    temperature_2m_max: [18.5, 20.1, 15.3],
    temperature_2m_min: [8.2, 10.5, 7.1],
    weathercode: [0, 2, 61],
  },
};

describe('WeatherService', () => {
  let service: WeatherService;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-03-01T10:00:00Z') });
    service = new WeatherService();
    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOpenMeteoResponse),
    });
    service.setFetch(mockFetch as unknown as typeof fetch);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should fetch forecast from Open-Meteo', async () => {
    const result = await service.getForecast('Madrid', 40.42, -3.7);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl.toString()).toContain('api.open-meteo.com/v1/forecast');
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      city: 'Madrid',
      date: '2026-03-01',
      tempMax: 18.5,
      tempMin: 8.2,
      weatherCode: 0,
      description: 'Clear sky',
    });
  });

  it('should cache results on second call', async () => {
    await service.getForecast('Madrid', 40.42, -3.7);
    await service.getForecast('Madrid', 40.42, -3.7);

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should not serve a cached city name to a caller with a different name', async () => {
    await service.getForecast('Madrid', 40.42, -3.7);
    const result = await service.getForecast('', 40.42, -3.7);

    expect(mockFetch).toHaveBeenCalledTimes(1); // still served from cache
    expect(result[0].city).toBe(''); // but stamped with the caller's name
  });

  it('should stamp the requested city name on cached data', async () => {
    await service.getForecast('', 40.42, -3.7);
    const result = await service.getForecast('Madrid', 40.42, -3.7);

    expect(result[0].city).toBe('Madrid');
  });

  it('should return weather for specific date', async () => {
    const result = await service.getForDate('Madrid', 40.42, -3.7, '2026-03-02');

    expect(result).toBeDefined();
    expect(result!.tempMax).toBe(20.1);
    expect(result!.description).toBe('Partly cloudy');
  });

  it('should return null for date not in forecast', async () => {
    const result = await service.getForDate('Madrid', 40.42, -3.7, '2026-04-01');

    expect(result).toBeNull();
  });

  it('should request enough forecast days to cover dates beyond the 7-day default', async () => {
    // 2026-03-11 is 10 days after the frozen "today" (2026-03-01) -> needs 11 days
    await service.getForDate('Madrid', 40.42, -3.7, '2026-03-11');

    const calledUrl = mockFetch.mock.calls[0][0] as URL;
    expect(calledUrl.searchParams.get('forecast_days')).toBe('11');
  });

  it('should return null without calling the API for dates beyond 16 days', async () => {
    const result = await service.getForDate('Madrid', 40.42, -3.7, '2026-03-20');

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should return null without calling the API for past dates', async () => {
    const result = await service.getForDate('Madrid', 40.42, -3.7, '2026-02-20');

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should not reuse a shorter cached forecast for a longer request', async () => {
    await service.getForecast('Madrid', 40.42, -3.7, 7);
    await service.getForecast('Madrid', 40.42, -3.7, 11);

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('should return null without calling the API for a regex-valid but unreal date', async () => {
    const result = await service.getForDate('Madrid', 40.42, -3.7, '2026-13-01');

    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should throw on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(service.getForecast('Madrid', 40.42, -3.7)).rejects.toThrow(
      'Open-Meteo API error: 500',
    );
  });

  it('should pass an abort signal with a timeout to fetch', async () => {
    await service.getForecast('Madrid', 40.42, -3.7);

    const options = mockFetch.mock.calls[0][1] as RequestInit | undefined;
    expect(options?.signal).toBeInstanceOf(AbortSignal);
  });

  it('should translate fetch timeouts into a readable error', async () => {
    const timeoutError = Object.assign(new Error('The operation was aborted'), {
      name: 'TimeoutError',
    });
    mockFetch.mockRejectedValue(timeoutError);

    await expect(service.getForecast('Madrid', 40.42, -3.7)).rejects.toThrow(
      'Open-Meteo request timed out',
    );
  });
});
