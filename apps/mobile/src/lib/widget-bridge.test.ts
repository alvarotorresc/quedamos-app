import { describe, it, expect, vi, beforeEach } from 'vitest';

const issueToken = vi.fn();
const revokeToken = vi.fn();
const pluginMock = {
  hasSession: vi.fn(),
  setSession: vi.fn(),
  clearSession: vi.fn(),
  setGroups: vi.fn(),
  refreshWidgets: vi.fn(),
};
const registerPlugin = vi.fn(() => pluginMock);
let platform = 'android';

vi.mock('@capacitor/core', async () => {
  const actual = await vi.importActual('@capacitor/core');
  return {
    ...actual,
    Capacitor: { getPlatform: () => platform },
    registerPlugin: (...args: unknown[]) => registerPlugin(...args),
  };
});

vi.mock('../services/widget', () => ({
  widgetService: { issueToken: (...a: unknown[]) => issueToken(...a), revokeToken: (...a: unknown[]) => revokeToken(...a) },
}));

import {
  syncWidgetSession,
  clearWidgetSession,
  syncWidgetGroups,
  notifyWidgetDataChanged,
} from './widget-bridge';

describe('widget-bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    platform = 'android';
    pluginMock.hasSession.mockResolvedValue({ value: false });
    pluginMock.setSession.mockResolvedValue(undefined);
    pluginMock.clearSession.mockResolvedValue(undefined);
    pluginMock.setGroups.mockResolvedValue(undefined);
    pluginMock.refreshWidgets.mockResolvedValue(undefined);
    issueToken.mockResolvedValue({ token: 'qw_abc' });
    revokeToken.mockResolvedValue({ success: true });
  });

  it('syncWidgetSession issues a token and hands it to the native side when there is none', async () => {
    await syncWidgetSession();
    expect(issueToken).toHaveBeenCalledOnce();
    expect(pluginMock.setSession).toHaveBeenCalledWith({
      token: 'qw_abc',
      apiUrl: import.meta.env.VITE_API_URL,
    });
  });

  it('syncWidgetSession does nothing when the native side already has a session', async () => {
    pluginMock.hasSession.mockResolvedValue({ value: true });
    await syncWidgetSession();
    expect(issueToken).not.toHaveBeenCalled();
    expect(pluginMock.setSession).not.toHaveBeenCalled();
  });

  it('syncWidgetSession is a no-op on web', async () => {
    platform = 'web';
    await syncWidgetSession();
    expect(pluginMock.hasSession).not.toHaveBeenCalled();
  });

  it('syncWidgetSession swallows errors', async () => {
    issueToken.mockRejectedValue(new Error('offline'));
    await expect(syncWidgetSession()).resolves.toBeUndefined();
  });

  it('clearWidgetSession revokes on the backend and clears the native side', async () => {
    await clearWidgetSession();
    expect(revokeToken).toHaveBeenCalledOnce();
    expect(pluginMock.clearSession).toHaveBeenCalledOnce();
  });

  it('clearWidgetSession still clears natively when the revoke call fails', async () => {
    revokeToken.mockRejectedValue(new Error('offline'));
    await clearWidgetSession();
    expect(pluginMock.clearSession).toHaveBeenCalledOnce();
  });

  it('syncWidgetGroups forwards the groups', async () => {
    const groups = [{ id: 'g1', name: 'Cuadrilla', emoji: '👥' }];
    await syncWidgetGroups(groups);
    expect(pluginMock.setGroups).toHaveBeenCalledWith({ groups });
  });

  it('notifyWidgetDataChanged pokes the native refresh', async () => {
    await notifyWidgetDataChanged();
    expect(pluginMock.refreshWidgets).toHaveBeenCalledOnce();
  });

  it('registers the native plugin under the expected name on first use', async () => {
    // El módulo cachea el plugin tras el primer registro (lazy singleton):
    // hace falta una instancia fresca para observar la llamada a registerPlugin.
    vi.resetModules();
    const fresh = await import('./widget-bridge');
    await fresh.syncWidgetSession();
    expect(registerPlugin).toHaveBeenCalledWith('WidgetBridge');
  });
});
