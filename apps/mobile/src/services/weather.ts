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
  getGroupWeather: (groupId: string) => api.get<WeatherData[]>(`/groups/${groupId}/weather`),

  getForecast: (groupId: string, date: string, lat: number, lon: number) => {
    const params = new URLSearchParams({ date, lat: String(lat), lon: String(lon) });
    return api.get<WeatherData | null>(`/groups/${groupId}/weather/forecast?${params.toString()}`);
  },
};

export const citiesService = {
  getAll: (groupId: string) => api.get<GroupCity[]>(`/groups/${groupId}/cities`),

  add: (groupId: string, data: AddCityDto) =>
    api.post<GroupCity>(`/groups/${groupId}/cities`, data),

  remove: (groupId: string, cityId: string) =>
    api.delete<{ success: boolean }>(`/groups/${groupId}/cities/${cityId}`),
};

export async function searchCities(query: string): Promise<GeocodingResult[]> {
  if (!query || query.length < 2) return [];
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&accept-language=es,en`;
  const res = await fetch(url, { headers: { 'User-Agent': 'QuedamosApp/0.2' } });
  if (!res.ok) return [];
  const json: any[] = await res.json();
  return json.map((r) => ({
    name: r.name || r.display_name.split(',')[0],
    latitude: parseFloat(r.lat),
    longitude: parseFloat(r.lon),
    country: r.address?.country ?? '',
    admin1: r.address?.city ?? r.address?.town ?? r.address?.municipality ?? r.address?.state,
  }));
}
