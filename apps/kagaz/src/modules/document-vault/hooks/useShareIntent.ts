/**
 * F-108 Receive Share: wires the native `ShareReceiver` plugin
 * (`share-receive.service.ts`) into the vault's existing `ingestFiles`
 * pipeline. Mounted once at the app root (`routes/index.tsx`, same posture
 * as `useHardwareBack`) so a share works no matter which screen is open
 * when it arrives — cold start (app launched via the share sheet) and warm
 * start (app already running) are both handled.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useIonRouter, useIonToast } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import { log } from '@/core/logging';
import { useUpload } from './useUpload';
import { useVaultStore } from '../store/vault.store';
import {
  getPendingShare,
  isShareReceiveSupported,
  onShareReceived,
  pendingShareToIncomingFiles,
  type PendingShare,
} from '../services/share-receive.service';

const logger = log('document-vault');

/** Imports a share and surfaces the result exactly like a manual upload would. */
export function useShareIntent(): void {
  const { isReady, ingestFiles } = useUpload();
  const router = useIonRouter();
  const [presentToast] = useIonToast();
  const { t } = useTranslation('documents');
  const processedInitial = useRef(false);

  const importShare = useCallback(
    async (share: PendingShare): Promise<void> => {
      const files = await pendingShareToIncomingFiles(share);
      if (files.length === 0) {
        // Text-only share (no file/image attached) — not this feature's scope.
        return;
      }
      try {
        const { uploaded } = await ingestFiles(files);
        if (uploaded === 0) {
          // Bug-audit fix: ingestFiles() never throws for a per-file
          // validation failure (oversized/corrupt/unsupported) — it's
          // collected into the vault store's lastUploadErrors and the
          // promise resolves normally. This used to return silently here
          // with no toast at all, leaving the user with no idea the share
          // was rejected rather than quietly imported.
          const errorKeys = useVaultStore.getState().lastUploadErrors;
          void presentToast({
            message:
              errorKeys.length > 0
                ? errorKeys.map((key) => t(key)).join('\n')
                : t('upload.errors.file_read_error'),
            duration: 4000,
            color: 'danger',
            position: 'bottom',
          });
          return;
        }
        router.push('/vault');
        void presentToast({
          message: t('upload.success', { count: uploaded }),
          duration: 2500,
          position: 'bottom',
        });
      } catch (error) {
        logger.warn({
          event: 'vault.share_receive.import_error',
          err: { message: String(error) },
        });
        void presentToast({
          message: t('upload.errors.file_read_error'),
          duration: 2500,
          position: 'bottom',
        });
      }
    },
    [ingestFiles, router, presentToast, t]
  );

  // Read the latest importShare via a ref rather than an effect dependency:
  // the effect below must set up its listener exactly once (guarded by
  // processedInitial), and re-running it whenever importShare's identity
  // changes (e.g. presentToast/router re-render) would unsubscribe the live
  // listener without ever resubscribing it, since the guard short-circuits.
  const importShareRef = useRef(importShare);
  useEffect(() => {
    importShareRef.current = importShare;
  });

  useEffect(() => {
    if (
      !Capacitor.isNativePlatform() ||
      !isShareReceiveSupported() ||
      !isReady ||
      processedInitial.current
    ) {
      return undefined;
    }
    processedInitial.current = true;
    void getPendingShare().then((share) => importShareRef.current(share));

    let unsubscribe: (() => void) | undefined;
    void onShareReceived((share) => {
      void importShareRef.current(share);
    }).then((handle) => {
      unsubscribe = (): void => void handle.remove();
    });
    return (): void => unsubscribe?.();
  }, [isReady]);
}
