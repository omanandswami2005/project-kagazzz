/**
 * Thumbnail loader (F-24): reads a cached thumbnail file from storage and
 * exposes it as an object URL for an <img>, revoking it on cleanup.
 * Returns null while loading, when there is no thumbnail, or on failure
 * (the row then shows a generic icon).
 */
import { useEffect, useMemo, useState } from 'react';
import { log } from '@/core/logging';
import { bytesToBase64, createFileStorage } from '@/infrastructure/filesystem';

const logger = log('document-vault');

/** Returns an object/data URL for the thumbnail at `path`, or null. */
export function useThumbnail(path: string | undefined): string | null {
  const storage = useMemo(() => createFileStorage(), []);
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);

  useEffect(() => {
    // Effect only runs the async load; no synchronous setState. The
    // no-path case is handled by deriving the return value below.
    if (!path) {
      return undefined;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    void (async (): Promise<void> => {
      try {
        const bytes = await storage.read(path);
        if (cancelled) {
          return;
        }
        // Blob URLs need a real Blob; fall back to a data URL where the
        // platform lacks URL.createObjectURL.
        if (typeof URL !== 'undefined' && URL.createObjectURL) {
          const copy = new ArrayBuffer(bytes.byteLength);
          new Uint8Array(copy).set(bytes);
          objectUrl = URL.createObjectURL(
            new Blob([copy], { type: 'image/jpeg' })
          );
          setLoadedUrl(objectUrl);
        } else {
          setLoadedUrl(`data:image/jpeg;base64,${bytesToBase64(bytes)}`);
        }
      } catch (error) {
        logger.debug({
          event: 'vault.thumbnail.read.failed',
          err: { message: String(error) },
        });
      }
    })();
    return (): void => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [path, storage]);

  // No path → no thumbnail, regardless of any previously loaded url.
  return path ? loadedUrl : null;
}
