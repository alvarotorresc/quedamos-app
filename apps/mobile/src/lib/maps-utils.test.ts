import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getGoogleMapsUrl, openInMaps, hasCoordinates } from './maps-utils';

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

  it('should use coordinates when provided', () => {
    const url = getGoogleMapsUrl('Retiro Park', 40.4153, -3.6845);
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=40.4153,-3.6845');
  });

  it('should use location text when no coordinates', () => {
    const url = getGoogleMapsUrl('Retiro Park');
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=Retiro%20Park');
  });

  it('should use location text when only lat is provided', () => {
    const url = getGoogleMapsUrl('Retiro Park', 40.4153, undefined);
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=Retiro%20Park');
  });

  it('should use location text when only lon is provided', () => {
    const url = getGoogleMapsUrl('Retiro Park', undefined, -3.6845);
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=Retiro%20Park');
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

  it('should open Google Maps URL with coordinates when provided', () => {
    openInMaps('Retiro Park', 40.4153, -3.6845);

    expect(window.open).toHaveBeenCalledWith(
      'https://www.google.com/maps/search/?api=1&query=40.4153,-3.6845',
      '_blank',
    );
  });
});

describe('hasCoordinates', () => {
  it('should return true when both lat and lon are provided', () => {
    expect(hasCoordinates(40.4153, -3.6845)).toBe(true);
  });

  it('should return false when lat is missing', () => {
    expect(hasCoordinates(undefined, -3.6845)).toBe(false);
  });

  it('should return false when lon is missing', () => {
    expect(hasCoordinates(40.4153, undefined)).toBe(false);
  });

  it('should return false when both are missing', () => {
    expect(hasCoordinates(undefined, undefined)).toBe(false);
  });

  it('should return true when coordinates are zero', () => {
    expect(hasCoordinates(0, 0)).toBe(true);
  });
});
