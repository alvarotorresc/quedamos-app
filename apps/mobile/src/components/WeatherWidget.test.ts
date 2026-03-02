import { describe, it, expect } from 'vitest';
import { getWeatherIcon, getWeatherDescKey } from './WeatherWidget';

describe('getWeatherIcon', () => {
  it('should return ☀️ for code 0 (clear sky)', () => {
    expect(getWeatherIcon(0)).toBe('☀️');
  });

  it('should return ⛅ for codes 1–3 (partly cloudy)', () => {
    expect(getWeatherIcon(1)).toBe('⛅');
    expect(getWeatherIcon(2)).toBe('⛅');
    expect(getWeatherIcon(3)).toBe('⛅');
  });

  it('should return 🌫️ for codes 4–48 (fog)', () => {
    expect(getWeatherIcon(45)).toBe('🌫️');
    expect(getWeatherIcon(48)).toBe('🌫️');
  });

  it('should return 🌦️ for codes 49–55 (drizzle)', () => {
    expect(getWeatherIcon(51)).toBe('🌦️');
    expect(getWeatherIcon(55)).toBe('🌦️');
  });

  it('should return 🌧️ for codes 56–65 (rain)', () => {
    expect(getWeatherIcon(61)).toBe('🌧️');
    expect(getWeatherIcon(65)).toBe('🌧️');
  });

  it('should return 🌨️ for codes 66–75 (snow)', () => {
    expect(getWeatherIcon(71)).toBe('🌨️');
    expect(getWeatherIcon(75)).toBe('🌨️');
  });

  it('should return 🌧️ for codes 76–82 (rain showers)', () => {
    expect(getWeatherIcon(80)).toBe('🌧️');
    expect(getWeatherIcon(82)).toBe('🌧️');
  });

  it('should return 🌨️ for codes 83–86 (snow showers)', () => {
    expect(getWeatherIcon(85)).toBe('🌨️');
    expect(getWeatherIcon(86)).toBe('🌨️');
  });

  it('should return ⛈️ for codes >= 87 (thunderstorm)', () => {
    expect(getWeatherIcon(95)).toBe('⛈️');
    expect(getWeatherIcon(99)).toBe('⛈️');
  });

  // Boundary conditions
  it('boundary: code 3 is ⛅, code 4 is 🌫️', () => {
    expect(getWeatherIcon(3)).toBe('⛅');
    expect(getWeatherIcon(4)).toBe('🌫️');
  });

  it('boundary: code 48 is 🌫️, code 49 is 🌦️', () => {
    expect(getWeatherIcon(48)).toBe('🌫️');
    expect(getWeatherIcon(49)).toBe('🌦️');
  });

  it('boundary: code 55 is 🌦️, code 56 is 🌧️', () => {
    expect(getWeatherIcon(55)).toBe('🌦️');
    expect(getWeatherIcon(56)).toBe('🌧️');
  });

  it('boundary: code 82 is 🌧️, code 83 is 🌨️', () => {
    expect(getWeatherIcon(82)).toBe('🌧️');
    expect(getWeatherIcon(83)).toBe('🌨️');
  });

  it('boundary: code 86 is 🌨️, code 87 is ⛈️', () => {
    expect(getWeatherIcon(86)).toBe('🌨️');
    expect(getWeatherIcon(87)).toBe('⛈️');
  });
});

describe('getWeatherDescKey', () => {
  it('should return clear key for code 0', () => {
    expect(getWeatherDescKey(0)).toBe('weather.desc.clear');
  });

  it('should return partlyCloudy key for codes 1–3', () => {
    expect(getWeatherDescKey(1)).toBe('weather.desc.partlyCloudy');
    expect(getWeatherDescKey(3)).toBe('weather.desc.partlyCloudy');
  });

  it('should return foggy key for codes 4–48', () => {
    expect(getWeatherDescKey(45)).toBe('weather.desc.foggy');
  });

  it('should return drizzle key for codes 49–55', () => {
    expect(getWeatherDescKey(51)).toBe('weather.desc.drizzle');
  });

  it('should return rain key for codes 56–65', () => {
    expect(getWeatherDescKey(63)).toBe('weather.desc.rain');
  });

  it('should return snow key for codes 66–75', () => {
    expect(getWeatherDescKey(71)).toBe('weather.desc.snow');
  });

  it('should return showers key for codes 76–82', () => {
    expect(getWeatherDescKey(80)).toBe('weather.desc.showers');
  });

  it('should return snowShowers key for codes 83–86', () => {
    expect(getWeatherDescKey(85)).toBe('weather.desc.snowShowers');
  });

  it('should return thunderstorm key for codes >= 87', () => {
    expect(getWeatherDescKey(95)).toBe('weather.desc.thunderstorm');
    expect(getWeatherDescKey(99)).toBe('weather.desc.thunderstorm');
  });
});
