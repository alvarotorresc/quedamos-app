import { Injectable } from '@nestjs/common';

export interface WeatherData {
  city: string;
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  description: string;
}

interface CacheEntry {
  data: WeatherData[];
  timestamp: number;
}

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Foggy',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  71: 'Slight snow',
  73: 'Moderate snow',
  75: 'Heavy snow',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

@Injectable()
export class WeatherService {
  private readonly MAX_CACHE_SIZE = 500;
  private cache = new Map<string, CacheEntry>();
  private fetchFn: typeof fetch;

  constructor() {
    this.fetchFn = fetch;
  }

  /** Allow injecting a custom fetch for testing */
  setFetch(fn: typeof fetch): void {
    this.fetchFn = fn;
  }

  async getForecast(
    cityName: string,
    lat: number,
    lon: number,
    days: number = 7,
  ): Promise<WeatherData[]> {
    const cacheKey = `${lat.toFixed(2)},${lon.toFixed(2)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(lat));
    url.searchParams.set('longitude', String(lon));
    url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,weathercode');
    url.searchParams.set('timezone', 'auto');
    url.searchParams.set('forecast_days', String(days));

    const response = await this.fetchFn(url);
    if (!response.ok) {
      throw new Error(`Open-Meteo API error: ${response.status}`);
    }

    const json = await response.json();
    const daily = json.daily;

    const data: WeatherData[] = daily.time.map((date: string, i: number) => ({
      city: cityName,
      date,
      tempMax: daily.temperature_2m_max[i],
      tempMin: daily.temperature_2m_min[i],
      weatherCode: daily.weathercode[i],
      description: WEATHER_DESCRIPTIONS[daily.weathercode[i]] ?? 'Unknown',
    }));

    this.cache.set(cacheKey, { data, timestamp: Date.now() });

    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }

    return data;
  }

  async getForDate(
    cityName: string,
    lat: number,
    lon: number,
    date: string,
  ): Promise<WeatherData | null> {
    const forecast = await this.getForecast(cityName, lat, lon);
    return forecast.find((d) => d.date === date) ?? null;
  }
}
