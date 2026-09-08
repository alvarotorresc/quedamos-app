import { create } from 'zustand';
import { readPushPermission, type PushPermission } from '../lib/push-permission';

/** `unknown` only until the first read comes back. */
export type PushPermissionValue = PushPermission | 'unknown';

interface PushPermissionState {
  permission: PushPermissionValue;
  /** Re-reads the platform permission and publishes it to everyone showing it. */
  refresh: () => Promise<PushPermission>;
}

/**
 * One shared answer to "are avisos on?".
 *
 * The hook that registers for push lives in the tabs, while the banner that explains
 * a blocked permission lives on two other screens; a store keeps them from each
 * asking the platform on their own and disagreeing after the user changes it.
 */
export const usePushPermissionStore = create<PushPermissionState>((set) => ({
  permission: 'unknown',
  refresh: async () => {
    const permission = await readPushPermission();
    set((state) => (state.permission === permission ? state : { permission }));
    return permission;
  },
}));
