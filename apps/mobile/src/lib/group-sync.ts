import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

export type SyncResource = 'availability' | 'events' | 'groups';

type SyncCallback = (resource: SyncResource) => void;

interface ChannelEntry {
  channel: RealtimeChannel;
  listeners: Set<SyncCallback>;
}

const channels = new Map<string, ChannelEntry>();

function getChannelName(groupId: string): string {
  return `group:${groupId}`;
}

export function subscribeToGroup(groupId: string, onSync: SyncCallback): () => void {
  const name = getChannelName(groupId);
  let entry = channels.get(name);

  if (!entry) {
    const channel = supabase.channel(name);

    channel.on('broadcast', { event: 'sync' }, (payload) => {
      const resource = payload.payload?.resource as SyncResource | undefined;
      if (resource) {
        const current = channels.get(name);
        current?.listeners.forEach((cb) => cb(resource));
      }
    });

    channel.subscribe();

    entry = { channel, listeners: new Set() };
    channels.set(name, entry);
  }

  entry.listeners.add(onSync);

  return () => {
    const current = channels.get(name);
    if (!current) return;

    current.listeners.delete(onSync);

    if (current.listeners.size === 0) {
      supabase.removeChannel(current.channel);
      channels.delete(name);
    }
  };
}

export function broadcastSync(groupId: string, resource: SyncResource): void {
  const name = getChannelName(groupId);
  const entry = channels.get(name);

  if (entry) {
    entry.channel.send({
      type: 'broadcast',
      event: 'sync',
      payload: { resource },
    });
  } else {
    // No active channel — fire-and-forget via a temporary channel
    const tempChannel = supabase.channel(name);
    tempChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        tempChannel.send({
          type: 'broadcast',
          event: 'sync',
          payload: { resource },
        });
        // Clean up after a short delay to ensure message is sent
        setTimeout(() => supabase.removeChannel(tempChannel), 1000);
      }
    });
  }
}
