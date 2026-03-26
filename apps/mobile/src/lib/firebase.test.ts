import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock firebase/app
const mockInitializeApp = vi.fn().mockReturnValue({ name: 'test-app' });
vi.mock('firebase/app', () => ({
  initializeApp: mockInitializeApp,
}));

// Mock firebase/messaging
const mockGetMessaging = vi.fn().mockReturnValue({ type: 'messaging' });
const mockMessagingIsSupported = vi.fn().mockResolvedValue(true);
vi.mock('firebase/messaging', () => ({
  getMessaging: mockGetMessaging,
  isSupported: mockMessagingIsSupported,
}));

// Mock firebase/analytics
const mockGetAnalytics = vi.fn().mockReturnValue({ type: 'analytics' });
const mockAnalyticsIsSupported = vi.fn().mockResolvedValue(true);
const mockLogEventFn = vi.fn();
vi.mock('firebase/analytics', () => ({
  getAnalytics: mockGetAnalytics,
  isSupported: mockAnalyticsIsSupported,
  logEvent: mockLogEventFn,
}));

describe('firebase analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module cache so singletons are fresh
    vi.resetModules();
  });

  it('getFirebaseAnalytics returns analytics instance when supported', async () => {
    mockAnalyticsIsSupported.mockResolvedValue(true);
    const { getFirebaseAnalytics } = await import('./firebase');

    const analytics = await getFirebaseAnalytics();

    expect(analytics).toEqual({ type: 'analytics' });
    expect(mockGetAnalytics).toHaveBeenCalled();
  });

  it('getFirebaseAnalytics returns null when not supported', async () => {
    mockAnalyticsIsSupported.mockResolvedValue(false);
    const { getFirebaseAnalytics } = await import('./firebase');

    const analytics = await getFirebaseAnalytics();

    expect(analytics).toBeNull();
    expect(mockGetAnalytics).not.toHaveBeenCalled();
  });

  it('getFirebaseAnalytics returns cached instance on subsequent calls', async () => {
    mockAnalyticsIsSupported.mockResolvedValue(true);
    const { getFirebaseAnalytics } = await import('./firebase');

    const first = await getFirebaseAnalytics();
    const second = await getFirebaseAnalytics();

    expect(first).toBe(second);
    expect(mockGetAnalytics).toHaveBeenCalledTimes(1);
  });

  it('logEvent calls firebase logEvent when analytics is supported', async () => {
    mockAnalyticsIsSupported.mockResolvedValue(true);
    const { logEvent } = await import('./firebase');

    await logEvent('test_event', { key: 'value' });

    expect(mockLogEventFn).toHaveBeenCalledWith({ type: 'analytics' }, 'test_event', {
      key: 'value',
    });
  });

  it('logEvent does nothing when analytics is not supported', async () => {
    mockAnalyticsIsSupported.mockResolvedValue(false);
    const { logEvent } = await import('./firebase');

    await logEvent('test_event', { key: 'value' });

    expect(mockLogEventFn).not.toHaveBeenCalled();
  });

  it('logEvent never throws even if firebase fails', async () => {
    mockAnalyticsIsSupported.mockRejectedValue(new Error('network error'));
    const { logEvent } = await import('./firebase');

    // Should not throw
    await expect(logEvent('test_event')).resolves.toBeUndefined();
  });

  it('logEvent works without params', async () => {
    mockAnalyticsIsSupported.mockResolvedValue(true);
    const { logEvent } = await import('./firebase');

    await logEvent('simple_event');

    expect(mockLogEventFn).toHaveBeenCalledWith({ type: 'analytics' }, 'simple_event', undefined);
  });

  it('logEvent works with empty params object', async () => {
    mockAnalyticsIsSupported.mockResolvedValue(true);
    const { logEvent } = await import('./firebase');

    await logEvent('event_with_empty', {});

    expect(mockLogEventFn).toHaveBeenCalledWith({ type: 'analytics' }, 'event_with_empty', {});
  });

  it('getFirebaseAnalytics handles concurrent calls without double init', async () => {
    mockAnalyticsIsSupported.mockResolvedValue(true);
    const { getFirebaseAnalytics } = await import('./firebase');

    const [a, b] = await Promise.all([getFirebaseAnalytics(), getFirebaseAnalytics()]);

    expect(a).toBe(b);
    expect(mockGetAnalytics).toHaveBeenCalledTimes(1);
  });

  it('logEvent never throws when getAnalytics fails', async () => {
    mockAnalyticsIsSupported.mockResolvedValue(true);
    mockGetAnalytics.mockImplementation(() => {
      throw new Error('getAnalytics failed');
    });
    const { logEvent } = await import('./firebase');

    await expect(logEvent('test_event')).resolves.toBeUndefined();
  });
});
