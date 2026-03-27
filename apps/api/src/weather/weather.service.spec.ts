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
    service = new WeatherService();
    mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockOpenMeteoResponse),
    });
    service.setFetch(mockFetch as unknown as typeof fetch);
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

  it('should throw on API error', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(service.getForecast('Madrid', 40.42, -3.7)).rejects.toThrow(
      'Open-Meteo API error: 500',
    );
  });
});
