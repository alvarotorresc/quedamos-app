import { useQuery } from '@tanstack/react-query';
import { weatherService } from '../services/weather';

export function useGroupWeather(groupId: string) {
  return useQuery({
    queryKey: ['weather', groupId],
    queryFn: () => weatherService.getGroupWeather(groupId),
    enabled: !!groupId,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}

export function useForecast(
  groupId: string,
  date: string | null,
  lat: number | null,
  lon: number | null,
) {
  return useQuery({
    queryKey: ['weather', 'forecast', groupId, date, lat, lon],
    queryFn: () => weatherService.getForecast(groupId, date!, lat!, lon!),
    enabled: !!(groupId && date && lat !== null && lon !== null),
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
}
