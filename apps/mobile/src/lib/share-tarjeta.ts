/**
 * Native-share pipeline for the shareable aro card rendered by
 * `lib/tarjeta.ts`. Mirrors the pattern in `ics-utils.ts`: on native
 * platforms the PNG is written to the cache directory and handed to the
 * native share sheet as a real file URI; on the web it prefers the File
 * Web Share API and falls back to a direct download plus a clipboard copy
 * of the invite link.
 */

import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export interface ShareTarjetaOpts {
  /** PNG rendered by `renderTarjetaCerrada`/`renderTarjetaSellada`. */
  blob: Blob;
  /** Already-interpolated caption (`share.tarjetaCerrada` / `share.tarjetaSellada`). */
  texto: string;
  inviteUrl: string;
  filename: string;
  /**
   * Caller's `useToast().showInfo`. Used only for the web fallback's "link
   * copied" confirmation — optional so this stays a plain lib function with
   * no React/Ionic dependency. If omitted, the web fallback still runs
   * (download + clipboard copy) but shows no toast.
   */
  showInfo?: (messageKey: string) => void;
}

function isShareCancel(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  if (error instanceof Error && /cancel/i.test(error.message)) return true;
  return false;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function downloadBlob(blob: Blob, filename: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

async function shareNative(opts: ShareTarjetaOpts): Promise<{ shared: boolean }> {
  const { blob, texto, inviteUrl, filename } = opts;

  // Share requires a real file URI, not a data URL — write to cache first.
  const base64Data = await blobToBase64(blob);
  const result = await Filesystem.writeFile({
    path: filename,
    data: base64Data,
    directory: Directory.Cache,
  });

  try {
    await Share.share({
      title: texto,
      text: `${texto} ${inviteUrl}`,
      url: result.uri,
    });
  } catch (error) {
    if (isShareCancel(error)) return { shared: false };
    throw error;
  }
  return { shared: true };
}

async function shareWeb(opts: ShareTarjetaOpts): Promise<{ shared: boolean }> {
  const { blob, texto, inviteUrl, filename, showInfo } = opts;
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: texto, url: inviteUrl });
    } catch (error) {
      if (isShareCancel(error)) return { shared: false };
      throw error;
    }
    return { shared: true };
  }

  downloadBlob(blob, filename);
  await navigator.clipboard.writeText(inviteUrl);
  showInfo?.('share.linkCopied');
  return { shared: true };
}

export async function shareTarjeta(opts: ShareTarjetaOpts): Promise<{ shared: boolean }> {
  if (Capacitor.isNativePlatform()) {
    return shareNative(opts);
  }
  return shareWeb(opts);
}
