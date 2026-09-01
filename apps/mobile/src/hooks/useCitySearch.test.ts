import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCitySearch } from './useCitySearch';
import { searchCities } from '../services/weather';

vi.mock('../services/weather', () => ({ searchCities: vi.fn() }));

describe('useCitySearch', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });
  afterEach(() => vi.useRealTimers());

  it('does not search for queries shorter than minChars', async () => {
    renderHook(() => useCitySearch('M'));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(searchCities).not.toHaveBeenCalled();
  });

  it('debounces and returns results after the delay', async () => {
    vi.mocked(searchCities).mockResolvedValue([
      { name: 'Madrid', latitude: 40.4, longitude: -3.7, country: 'Spain' },
    ]);
    const { result } = renderHook(() => useCitySearch('Madrid'));
    await act(async () => {
      await vi.runAllTimersAsync();
    });
    expect(searchCities).toHaveBeenCalledTimes(1);
    expect(result.current[0].name).toBe('Madrid');
  });

  it('ignores a stale in-flight response when the query changes', async () => {
    let resolveFirst!: (v: unknown) => void;
    vi.mocked(searchCities)
      .mockImplementationOnce(
        () => new Promise((r) => { resolveFirst = r as never; }),
      )
      .mockResolvedValueOnce([
        { name: 'Malaga', latitude: 36.7, longitude: -4.4, country: 'Spain' },
      ]);

    const { result, rerender } = renderHook(({ q }) => useCitySearch(q), {
      initialProps: { q: 'Mad' },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300); // fires first fetch (pending)
    });

    rerender({ q: 'Mal' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300); // fires second fetch (resolves)
    });

    // Late first response must NOT overwrite the newer result
    await act(async () => {
      resolveFirst([{ name: 'Madrid', latitude: 40.4, longitude: -3.7, country: 'Spain' }]);
      await vi.runAllTimersAsync();
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0].name).toBe('Malaga');
  });
});
