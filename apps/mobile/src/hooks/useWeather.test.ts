import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGroupWeather, useForecast } from './useWeather';
import { weatherService } from '../services/weather';
import { createWrapper } from '../test/test-utils';

vi.mock('../services/weather', () => ({
  weatherService: {
    getGroupWeather: vi.fn(),
    getForecast: vi.fn(),
  },
}));

function createWeatherData(overrides: Record<string, unknown> = {}) {
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

describe('useGroupWeather', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch weather for group', async () => {
    const weather = [createWeatherData(), createWeatherData({ date: '2026-03-02', tempMax: 20.1 })];
    vi.mocked(weatherService.getGroupWeather).mockResolvedValue(weather as any);

    const { result } = renderHook(() => useGroupWeather('group-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(weather);
    expect(weatherService.getGroupWeather).toHaveBeenCalledWith('group-1');
  });

  it('should not fetch when groupId is empty', () => {
    const { result } = renderHook(() => useGroupWeather(''), { wrapper: createWrapper() });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle error', async () => {
    vi.mocked(weatherService.getGroupWeather).mockRejectedValue(new Error('API Error'));

    const { result } = renderHook(() => useGroupWeather('group-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it('should return empty array when no cities configured', async () => {
    vi.mocked(weatherService.getGroupWeather).mockResolvedValue([]);

    const { result } = renderHook(() => useGroupWeather('group-1'), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('useForecast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch forecast when all params are provided', async () => {
    const forecast = createWeatherData({ city: 'Barcelona' });
    vi.mocked(weatherService.getForecast).mockResolvedValue(forecast as any);

    const { result } = renderHook(() => useForecast('group-1', '2026-03-15', 41.38, 2.15), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(forecast);
    expect(weatherService.getForecast).toHaveBeenCalledWith('group-1', '2026-03-15', 41.38, 2.15);
  });

  it('should not fetch when date is null', () => {
    const { result } = renderHook(() => useForecast('group-1', null, 41.38, 2.15), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should not fetch when lat is null', () => {
    const { result } = renderHook(() => useForecast('group-1', '2026-03-15', null, 2.15), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should not fetch when lon is null', () => {
    const { result } = renderHook(() => useForecast('group-1', '2026-03-15', 41.38, null), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should not fetch when groupId is empty', () => {
    const { result } = renderHook(() => useForecast('', '2026-03-15', 41.38, 2.15), {
      wrapper: createWrapper(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('should handle null response gracefully', async () => {
    vi.mocked(weatherService.getForecast).mockResolvedValue(null as any);

    const { result } = renderHook(() => useForecast('group-1', '2026-03-15', 41.38, 2.15), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
  });

  it('should handle error', async () => {
    vi.mocked(weatherService.getForecast).mockRejectedValue(new Error('Forecast error'));

    const { result } = renderHook(() => useForecast('group-1', '2026-03-15', 41.38, 2.15), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
