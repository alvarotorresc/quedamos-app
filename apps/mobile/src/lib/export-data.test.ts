import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { saveExport, serializeExport, EXPORT_FILENAME } from './export-data';

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => false),
  },
}));

vi.mock('@capacitor/filesystem', () => ({
  Filesystem: {
    writeFile: vi.fn(() => Promise.resolve({ uri: 'file:///cache/quedamos-export.json' })),
  },
  Directory: {
    Cache: 'CACHE',
  },
  Encoding: {
    UTF8: 'utf8',
  },
}));

vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn(() => Promise.resolve()),
  },
}));

const data = { profile: { id: 'user-1', name: 'Ana' }, groups: [] };

describe('serializeExport', () => {
  it('pretty-prints the JSON so the file is readable as is', () => {
    expect(serializeExport(data)).toBe(JSON.stringify(data, null, 2));
  });
});

describe('saveExport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(URL, 'createObjectURL');
    Reflect.deleteProperty(URL, 'revokeObjectURL');
  });

  it('web: downloads the JSON through a temporary link and revokes the blob URL later', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    const createObjectURL = vi.fn(() => 'blob:export');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const appendChild = vi.spyOn(document.body, 'appendChild');

    await expect(saveExport(data)).resolves.toEqual({ saved: true });

    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob.type).toBe('application/json;charset=utf-8');
    expect(await blob.text()).toBe(JSON.stringify(data, null, 2));
    const link = appendChild.mock.calls[0][0] as HTMLAnchorElement;
    expect(link.download).toBe(EXPORT_FILENAME);
    expect(link.href).toBe('blob:export');
    expect(click).toHaveBeenCalledTimes(1);
    expect(document.body.contains(link)).toBe(false);

    expect(revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
    click.mockRestore();
    appendChild.mockRestore();
  });

  it('native: writes the JSON as UTF-8 to the cache and offers the file through the share sheet', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const { Filesystem } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');

    await expect(saveExport(data)).resolves.toEqual({ saved: true });

    expect(Filesystem.writeFile).toHaveBeenCalledWith({
      path: EXPORT_FILENAME,
      data: JSON.stringify(data, null, 2),
      directory: 'CACHE',
      encoding: 'utf8',
    });
    expect(Share.share).toHaveBeenCalledWith({
      title: EXPORT_FILENAME,
      url: 'file:///cache/quedamos-export.json',
      dialogTitle: EXPORT_FILENAME,
    });
  });

  it('native: a dismissed share sheet resolves as not saved instead of failing', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const { Share } = await import('@capacitor/share');
    vi.mocked(Share.share).mockRejectedValueOnce(new DOMException('canceled', 'AbortError'));

    await expect(saveExport(data)).resolves.toEqual({ saved: false });
  });

  it('native: a real share error is propagated', async () => {
    const { Capacitor } = await import('@capacitor/core');
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const { Share } = await import('@capacitor/share');
    vi.mocked(Share.share).mockRejectedValueOnce(new Error('no activity found'));

    await expect(saveExport(data)).rejects.toThrow('no activity found');
  });
});
