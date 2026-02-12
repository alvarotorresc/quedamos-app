import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { subscribeToGroup, type SyncResource } from '../lib/group-sync';

export function useGroupSync(groupId: string | undefined): void {
  const queryClient = useQueryClient();

  const handleSync = useCallback(
    (resource: SyncResource) => {
      if (!groupId) return;

      switch (resource) {
        case 'availability':
          queryClient.invalidateQueries({ queryKey: ['availability', groupId] });
          break;
        case 'events':
          queryClient.invalidateQueries({ queryKey: ['events', groupId] });
          break;
        case 'groups':
          queryClient.invalidateQueries({ queryKey: ['groups'] });
          queryClient.invalidateQueries({ queryKey: ['groups', groupId] });
          break;
      }
    },
    [groupId, queryClient],
  );

  useEffect(() => {
    if (!groupId) return;
    return subscribeToGroup(groupId, handleSync);
  }, [groupId, handleSync]);
}
