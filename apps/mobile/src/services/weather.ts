import { api } from '../lib/api';

export interface WeatherData {
  city: string;
  date: string;
  tempMax: number;
  tempMin: number;
  weatherCode: number;
  description: string;
}

export interface GroupCity {
  id: string;
  groupId: string;
  name: string;
  lat: number;
  lon: number;
}

export interface AddCityDto {
  name: string;
  lat: number;
  lon: number;
}

export interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country: string;
  admin1?: string;
}

export const weatherService = {
  getGroupWeather: (groupId: string) =>
    api.get<WeatherData[]>(`/groups/${groupId}/weather`),

  getForecast: (groupId: string, date: string, lat: number, lon: number) => {
    const params = new URLSearchParams({ date, lat: String(lat), lon: String(lon) });
    return api.get<WeatherData | null>(`/groups/${groupId}/weather/forecast?${params.toString()}`);
  },
};

export const citiesService = {
  getAll: (groupId: string) =>
    api.get<GroupCity[]>(`/groups/${groupId}/cities`),

  add: (groupId: string, data: AddCityDto) =>
    api.post<GroupCity>(`/groups/${groupId}/cities`, data),

  remove: (groupId: string, cityId: string) =>
    api.delete<{ success: boolean }>(`/groups/${groupId}/cities/${cityId}`),
};

export async function searchCities(query: string): Promise<GeocodingResult[]> {
  if (!query || query.length < 2) return [];
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en`,
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json.results ?? []).map((r: any) => ({
    name: r.name,
    latitude: r.latitude,
    longitude: r.longitude,
    country: r.country,
    admin1: r.admin1,
  }));
}
