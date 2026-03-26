import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the firebase logEvent — use vi.hoisted to avoid hoisting issues
const { mockLogEvent } = vi.hoisted(() => ({
  mockLogEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/firebase', () => ({
  logEvent: mockLogEvent,
}));

import { useAnalytics, useScreenView } from './useAnalytics';

describe('useAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('track calls logEvent with event name and params', () => {
    const { result } = renderHook(() => useAnalytics());

    act(() => {
      result.current.track('test_event', { key: 'value' });
    });

    expect(mockLogEvent).toHaveBeenCalledWith('test_event', { key: 'value' });
  });

  it('track calls logEvent without params', () => {
    const { result } = renderHook(() => useAnalytics());

    act(() => {
      result.current.track('simple_event');
    });

    expect(mockLogEvent).toHaveBeenCalledWith('simple_event', undefined);
  });

  it('track silently catches errors from logEvent', async () => {
    mockLogEvent.mockRejectedValueOnce(new Error('analytics error'));
    const { result } = renderHook(() => useAnalytics());

    act(() => {
      result.current.track('failing_event');
    });

    // Wait for the rejected promise to be caught
    await vi.waitFor(() => {
      expect(mockLogEvent).toHaveBeenCalledWith('failing_event', undefined);
    });
  });

  it('track returns stable reference between renders', () => {
    const { result, rerender } = renderHook(() => useAnalytics());
    const firstTrack = result.current.track;

    rerender();

    expect(result.current.track).toBe(firstTrack);
  });
});

describe('useScreenView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs screen_view event on mount', () => {
    renderHook(() => useScreenView('TestScreen'));

    expect(mockLogEvent).toHaveBeenCalledWith('screen_view', {
      screen_name: 'TestScreen',
    });
  });

  it('logs screen_view only once even on rerender', () => {
    const { rerender } = renderHook(() => useScreenView('TestScreen'));

    rerender();
    rerender();

    expect(mockLogEvent).toHaveBeenCalledTimes(1);
  });

  it('does not log again with same screen name after rerender', () => {
    const { rerender } = renderHook(({ name }) => useScreenView(name), {
      initialProps: { name: 'Screen1' },
    });

    rerender({ name: 'Screen1' });

    expect(mockLogEvent).toHaveBeenCalledTimes(1);
  });

  it('tracks only the initial screen name on mount', () => {
    const { rerender } = renderHook(({ name }) => useScreenView(name), {
      initialProps: { name: 'Screen1' },
    });

    rerender({ name: 'Screen2' });

    expect(mockLogEvent).toHaveBeenCalledTimes(1);
    expect(mockLogEvent).toHaveBeenCalledWith('screen_view', {
      screen_name: 'Screen1',
    });
  });

  it('handles empty screen name without errors', () => {
    renderHook(() => useScreenView(''));

    expect(mockLogEvent).toHaveBeenCalledWith('screen_view', {
      screen_name: '',
    });
  });
});
