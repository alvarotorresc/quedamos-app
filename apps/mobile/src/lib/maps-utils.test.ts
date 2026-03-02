import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGoogleMapsUrl, openInMaps } from './maps-utils';

describe('getGoogleMapsUrl', () => {
  it('should encode location in Google Maps URL', () => {
    const url = getGoogleMapsUrl('Retiro Park Madrid');
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=Retiro%20Park%20Madrid');
  });

  it('should handle special characters', () => {
    const url = getGoogleMapsUrl('Cafe & Bar');
    expect(url).toContain('Cafe%20%26%20Bar');
  });

  it('should handle empty string', () => {
    const url = getGoogleMapsUrl('');
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=');
  });
});

describe('openInMaps', () => {
  beforeEach(() => {
    vi.stubGlobal('open', vi.fn());
  });

  it('should open Google Maps URL in new tab', () => {
    openInMaps('Retiro Park Madrid');

    expect(window.open).toHaveBeenCalledWith(
      'https://www.google.com/maps/search/?api=1&query=Retiro%20Park%20Madrid',
      '_blank',
    );
  });
});
