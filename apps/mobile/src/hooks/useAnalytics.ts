import { useCallback, useEffect, useRef } from 'react';
import { logEvent } from '../lib/firebase';

export function useAnalytics() {
  const track = useCallback((event: string, params?: Record<string, string | number | boolean>) => {
    logEvent(event, params).catch(() => {});
  }, []);
  return { track };
}

export function useScreenView(screenName: string) {
  useEffect(() => {
    logEvent('screen_view', { screen_name: screenName }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
