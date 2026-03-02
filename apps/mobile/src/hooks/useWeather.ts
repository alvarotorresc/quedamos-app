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
