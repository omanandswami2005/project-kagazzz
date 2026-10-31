/**
 * State + actions for the optional on-device search model (EmbeddingGemma,
 * ~330 MB): a separate download from the chat model so chat works without it.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  SEARCH_MODEL_SIZE_BYTES,
  deleteSearchModel,
  downloadSearchModel,
  isSearchModelSupported,
  refreshSearchModelState,
} from '@/modules/semantic-index';

export type SearchModelStatus =
  | 'unsupported'
  | 'checking'
  | 'missing'
  | 'downloading'
  | 'ready'
  | 'error';

export interface UseSearchModel {
  status: SearchModelStatus;
  /** 0-100 while downloading. */
  progress: number;
  sizeBytes: number;
  download: () => Promise<void>;
  remove: () => Promise<void>;
}

export function useSearchModel(): UseSearchModel {
  const supported = isSearchModelSupported();
  const [status, setStatus] = useState<SearchModelStatus>(supported ? 'checking' : 'unsupported');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!supported) {
      return;
    }
    let cancelled = false;
    void refreshSearchModelState().then((ready) => {
      if (!cancelled) {
        setStatus(ready ? 'ready' : 'missing');
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [supported]);

  const download = useCallback(async (): Promise<void> => {
    setProgress(0);
    setStatus('downloading');
    try {
      await downloadSearchModel(setProgress);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  const remove = useCallback(async (): Promise<void> => {
    await deleteSearchModel();
    setStatus('missing');
  }, []);

  return { status, progress, sizeBytes: SEARCH_MODEL_SIZE_BYTES, download, remove };
}
