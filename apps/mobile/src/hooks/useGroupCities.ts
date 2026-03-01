import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { citiesService, AddCityDto } from '../services/weather';

export function useGroupCities(groupId: string) {
  return useQuery({
    queryKey: ['cities', groupId],
    queryFn: () => citiesService.getAll(groupId),
    enabled: !!groupId,
  });
}

export function useAddCity(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddCityDto) => citiesService.add(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities', groupId] });
      queryClient.invalidateQueries({ queryKey: ['weather', groupId] });
    },
  });
}

export function useRemoveCity(groupId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cityId: string) => citiesService.remove(groupId, cityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cities', groupId] });
      queryClient.invalidateQueries({ queryKey: ['weather', groupId] });
    },
  });
}
