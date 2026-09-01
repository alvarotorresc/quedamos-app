import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { shareTarjeta } from './share-tarjeta';

// Mock Capacitor modules — same shape as ics-utils.test.ts, overriding the
// global @capacitor/share mock from src/test/setup.ts so we control
// resolution/rejection per test.
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: vi.fn(() => Promise.resolve({ uri: 'file:///cache/tarjeta.png' })),
  },
  Directory: {
    Cache: 'CACHE',
  },
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn(() => Promise.resolve()),
  },
}));

function createBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
}

function baseOpts(overrides: Partial<Parameters<typeof shareTarjeta>[0]> = {}) {
  return {
    blob: createBlob(),
    texto: 'El aro se ha cerrado. Podéis 3 el 12 de abril.',
    inviteUrl: 'https://quedamos.app/i/ABC123',
    filename: 'quedamos-tarjeta.png',
    ...overrides,
  };
}

describe('shareTarjeta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Undo any per-test navigator stubs — jsdom has none of these by
    // default, so deleting restores the pristine "not present" state.
    Reflect.deleteProperty(navigator, 'share');
    Reflect.deleteProperty(navigator, 'canShare');
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('native: writes the blob to Cache as base64 and shares the real uri with text containing the inviteUrl', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const { Filesystem } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    await shareTarjeta(baseOpts());

    expect(Filesystem.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        path: 'quedamos-tarjeta.png',
        data: 'AQID',
        directory: 'CACHE',
      }),
    );

    expect(Share.share).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'El aro se ha cerrado. Podéis 3 el 12 de abril.',
        text: expect.stringContaining('https://quedamos.app/i/ABC123'),
        url: 'file:///cache/tarjeta.png',
      }),
    );
  });

  it('web with file-share support: calls navigator.share with a File named per filename', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    const canShare = vi.fn(() => true);
    const share = vi.fn((_data: { files: File[]; text: string; url: string }) => Promise.resolve());
    Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true });
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });

    await shareTarjeta(baseOpts());

    expect(canShare).toHaveBeenCalled();
    expect(share).toHaveBeenCalledTimes(1);
    const [call] = share.mock.calls[0];
    expect(call.files).toHaveLength(1);
    expect(call.files[0].name).toBe('quedamos-tarjeta.png');
    expect(call.files[0].type).toBe('image/png');
    expect(call.url).toBe('https://quedamos.app/i/ABC123');
  });

  it('web without file-share support: downloads via anchor, copies the inviteUrl and shows a confirmation toast', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    globalThis.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/fake');
    const revokeUrlSpy = vi.fn();
    globalThis.URL.revokeObjectURL = revokeUrlSpy;

    const clickSpy = vi.fn();
    const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click: clickSpy,
    } as unknown as HTMLAnchorElement);
    const appendSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node);
    const removeSpy = vi.spyOn(document.body, 'removeChild').mockImplementation((node) => node);

    const writeText = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const showInfo = vi.fn();

    await shareTarjeta(baseOpts({ showInfo }));

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(clickSpy).toHaveBeenCalled();
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(revokeUrlSpy).toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith('https://quedamos.app/i/ABC123');
    expect(showInfo).toHaveBeenCalledWith(expect.any(String));

    createElementSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('native: a cancelled share sheet (Capacitor rejection) resolves silently with no toast', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const { Share } = await import('@capacitor/share');
    vi.mocked(Share.share).mockRejectedValue(new Error('Share canceled'));

    const showInfo = vi.fn();

    await expect(shareTarjeta(baseOpts({ showInfo }))).resolves.toBeUndefined();
    expect(showInfo).not.toHaveBeenCalled();
  });

  it('web: a cancelled share sheet (AbortError) resolves silently with no toast', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    Object.defineProperty(navigator, 'canShare', { value: vi.fn(() => true), configurable: true });
    const share = vi.fn(() => Promise.reject(new DOMException('The user aborted a request.', 'AbortError')));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });

    const showInfo = vi.fn();

    await expect(shareTarjeta(baseOpts({ showInfo }))).resolves.toBeUndefined();
    expect(showInfo).not.toHaveBeenCalled();
  });

  it('native: a real failure rejects instead of resolving', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const { Filesystem } = await import('@capacitor/filesystem');
    vi.mocked(Filesystem.writeFile).mockRejectedValue(new Error('disk full'));

    await expect(shareTarjeta(baseOpts())).rejects.toThrow('disk full');
  });

  it('web with file-share support: a real share failure rejects instead of resolving', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    Object.defineProperty(navigator, 'canShare', { value: vi.fn(() => true), configurable: true });
    const share = vi.fn(() => Promise.reject(new Error('network error')));
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });

    await expect(shareTarjeta(baseOpts())).rejects.toThrow('network error');
  });
});
