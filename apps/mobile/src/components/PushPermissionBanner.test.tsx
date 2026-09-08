import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { PushPermissionBanner } from './PushPermissionBanner';
import { usePushPermissionStore } from '../stores/push-permission';
import { readPushPermission } from '../lib/push-permission';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: vi.fn().mockReturnValue(false) },
}));

vi.mock('../lib/push-permission', () => ({
  readPushPermission: vi.fn().mockResolvedValue('granted'),
}));

/** Renders and lets the mount-time re-read settle. */
async function renderBanner() {
  const view = render(<PushPermissionBanner />);
  await act(async () => {
    await Promise.resolve();
  });
  return view;
}

describe('PushPermissionBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.mocked(readPushPermission).mockResolvedValue('granted');
    usePushPermissionStore.setState({ permission: 'unknown' });
  });

  it('says nothing while the avisos work', async () => {
    usePushPermissionStore.setState({ permission: 'granted' });

    const { container } = await renderBanner();

    expect(container).toBeEmptyDOMElement();
  });

  it('says nothing when the permission has not been asked yet', async () => {
    usePushPermissionStore.setState({ permission: 'prompt' });

    const { container } = await renderBanner();

    expect(container).toBeEmptyDOMElement();
  });

  it('explains where to unblock them on the web', async () => {
    usePushPermissionStore.setState({ permission: 'denied' });
    vi.mocked(readPushPermission).mockResolvedValue('denied');

    await renderBanner();

    expect(screen.getByText('push.blocked.title')).toBeInTheDocument();
    expect(screen.getByText('push.blocked.web')).toBeInTheDocument();
  });

  it('points at the Android settings on a device', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.mocked(readPushPermission).mockResolvedValue('denied');
    usePushPermissionStore.setState({ permission: 'denied' });

    await renderBanner();

    expect(screen.getByText('push.blocked.android')).toBeInTheDocument();
  });

  it('re-reads the permission on mount, in case it changed in the settings app', async () => {
    usePushPermissionStore.setState({ permission: 'denied' });
    vi.mocked(readPushPermission).mockResolvedValue('granted');

    const { container } = render(<PushPermissionBanner />);
    expect(screen.getByText('push.blocked.title')).toBeInTheDocument();

    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
