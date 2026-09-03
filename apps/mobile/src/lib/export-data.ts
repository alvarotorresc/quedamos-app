import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { isShareCancel } from './share-tarjeta';

export const EXPORT_FILENAME = 'quedamos-export.json';

export function serializeExport(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Saves the data export as a file. Same route as the ICS download: on Android
 * the file is written to the cache directory and handed to the share sheet
 * (Drive, Files, mail…); on the web it is a plain download.
 * Resolves `{ saved: false }` when the share sheet is dismissed.
 */
export async function saveExport(data: unknown): Promise<{ saved: boolean }> {
  const json = serializeExport(data);

  if (Capacitor.isNativePlatform()) {
    const result = await Filesystem.writeFile({
      path: EXPORT_FILENAME,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });

    try {
      await Share.share({
        title: EXPORT_FILENAME,
        url: result.uri,
        dialogTitle: EXPORT_FILENAME,
      });
    } catch (error) {
      if (isShareCancel(error)) return { saved: false };
      throw error;
    }
    return { saved: true };
  }

  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = EXPORT_FILENAME;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoking in the same tick makes Firefox cancel the download; give the
  // browser a moment to open the blob first.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { saved: true };
}
