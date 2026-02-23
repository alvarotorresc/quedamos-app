import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from './supabase';
import { subscribeToGroup, broadcastSync } from './group-sync';
import type { SyncResource } from './group-sync';

// supabase is already mocked globally in test/setup.ts
// We enhance the mock per-test as needed.

describe('group-sync', () => {
  let mockChannel: {
    on: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockChannel = {
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnThis(),
      send: vi.fn(),
    };
    vi.mocked(supabase.channel).mockReturnValue(mockChannel as never);
    vi.mocked(supabase.removeChannel).mockReturnValue(undefined as never);
  });

  describe('subscribeToGroup', () => {
    it('should create a channel with the correct name', () => {
      const callback = vi.fn();

      subscribeToGroup('group-123', callback);

      expect(supabase.channel).toHaveBeenCalledWith('group:group-123');
    });

    it('should set up broadcast listener for sync events', () => {
      const callback = vi.fn();

      subscribeToGroup('group-on', callback);

      expect(mockChannel.on).toHaveBeenCalledWith(
        'broadcast',
        { event: 'sync' },
        expect.any(Function),
      );
    });

    it('should call subscribe on the channel', () => {
      const callback = vi.fn();

      subscribeToGroup('group-sub', callback);

      expect(mockChannel.subscribe).toHaveBeenCalled();
    });

    it('should return an unsubscribe function', () => {
      const callback = vi.fn();

      const unsubscribe = subscribeToGroup('group-ret', callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should invoke callback when a broadcast event is received', () => {
      const callback = vi.fn();

      subscribeToGroup('group-cb', callback);

      // Extract the broadcast handler registered via channel.on
      const onHandler = vi.mocked(mockChannel.on).mock.calls[0][2] as (payload: {
        payload: { resource: SyncResource };
      }) => void;

      onHandler({ payload: { resource: 'availability' } });

      expect(callback).toHaveBeenCalledWith('availability');
    });

    it('should not invoke callback when resource is missing from payload', () => {
      const callback = vi.fn();

      subscribeToGroup('group-nores', callback);

      const onHandler = vi.mocked(mockChannel.on).mock.calls[0][2] as (payload: {
        payload: Record<string, unknown>;
      }) => void;

      onHandler({ payload: {} });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should reuse existing channel for the same group', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      subscribeToGroup('group-reuse', cb1);
      subscribeToGroup('group-reuse', cb2);

      // supabase.channel should only be called once for the same group
      const channelCalls = vi.mocked(supabase.channel).mock.calls.filter(
        (call) => call[0] === 'group:group-reuse',
      );
      expect(channelCalls).toHaveLength(1);
    });

    it('should notify all listeners for the same group', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      subscribeToGroup('group-multi', cb1);
      subscribeToGroup('group-multi', cb2);

      // Trigger the broadcast handler
      const onHandler = vi.mocked(mockChannel.on).mock.calls[0][2] as (payload: {
        payload: { resource: SyncResource };
      }) => void;

      onHandler({ payload: { resource: 'events' } });

      expect(cb1).toHaveBeenCalledWith('events');
      expect(cb2).toHaveBeenCalledWith('events');
    });
  });

  describe('unsubscribe', () => {
    it('should remove the listener when unsubscribe is called', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = subscribeToGroup('group-unsub', cb1);
      subscribeToGroup('group-unsub', cb2);

      unsub1();

      // Trigger the broadcast handler
      const onHandler = vi.mocked(mockChannel.on).mock.calls[0][2] as (payload: {
        payload: { resource: SyncResource };
      }) => void;

      onHandler({ payload: { resource: 'groups' } });

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledWith('groups');
    });

    it('should remove the channel when last listener unsubscribes', () => {
      const callback = vi.fn();

      const unsubscribe = subscribeToGroup('group-last', callback);
      unsubscribe();

      expect(supabase.removeChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('should not remove the channel when other listeners remain', () => {
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = subscribeToGroup('group-remain', cb1);
      subscribeToGroup('group-remain', cb2);

      unsub1();

      expect(supabase.removeChannel).not.toHaveBeenCalled();
    });

    it('should handle calling unsubscribe twice gracefully', () => {
      const callback = vi.fn();

      const unsubscribe = subscribeToGroup('group-double', callback);
      unsubscribe();
      // Second call should not throw
      unsubscribe();

      // removeChannel called once during first unsubscribe, second is a no-op
      expect(supabase.removeChannel).toHaveBeenCalledTimes(1);
    });
  });

  describe('broadcastSync', () => {
    it('should send to existing channel if one is active', () => {
      const callback = vi.fn();

      subscribeToGroup('group-bcast', callback);

      broadcastSync('group-bcast', 'availability');

      expect(mockChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'sync',
        payload: { resource: 'availability' },
      });
    });

    it('should create a temporary channel when no active subscription exists', () => {
      const tempChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      // First call to supabase.channel returns tempChannel
      vi.mocked(supabase.channel).mockReturnValue(tempChannel as never);

      broadcastSync('group-temp', 'events');

      expect(supabase.channel).toHaveBeenCalledWith('group:group-temp');
      expect(tempChannel.subscribe).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should send broadcast when temporary channel becomes SUBSCRIBED', () => {
      const tempChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      vi.mocked(supabase.channel).mockReturnValue(tempChannel as never);

      broadcastSync('group-temp-send', 'groups');

      // Get the subscribe callback
      const subscribeCallback = vi.mocked(tempChannel.subscribe).mock
        .calls[0][0] as (status: string) => void;

      // Simulate the channel becoming subscribed
      subscribeCallback('SUBSCRIBED');

      expect(tempChannel.send).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'sync',
        payload: { resource: 'groups' },
      });
    });

    it('should clean up temporary channel after sending', () => {
      vi.useFakeTimers();

      const tempChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      vi.mocked(supabase.channel).mockReturnValue(tempChannel as never);

      broadcastSync('group-temp-cleanup', 'availability');

      const subscribeCallback = vi.mocked(tempChannel.subscribe).mock
        .calls[0][0] as (status: string) => void;

      subscribeCallback('SUBSCRIBED');

      // The cleanup happens after a setTimeout of 1000ms
      vi.advanceTimersByTime(1000);

      expect(supabase.removeChannel).toHaveBeenCalledWith(tempChannel);

      vi.useRealTimers();
    });

    it('should not send when temporary channel status is not SUBSCRIBED', () => {
      const tempChannel = {
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn().mockReturnThis(),
        send: vi.fn(),
      };

      vi.mocked(supabase.channel).mockReturnValue(tempChannel as never);

      broadcastSync('group-temp-pending', 'events');

      const subscribeCallback = vi.mocked(tempChannel.subscribe).mock
        .calls[0][0] as (status: string) => void;

      // Simulate a non-SUBSCRIBED status
      subscribeCallback('CHANNEL_ERROR');

      expect(tempChannel.send).not.toHaveBeenCalled();
    });
  });
});
