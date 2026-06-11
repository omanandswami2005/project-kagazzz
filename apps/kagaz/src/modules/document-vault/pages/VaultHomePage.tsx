/**
 * Vault home (02-document-vault-module.md §Module File Structure) —
 * replaces the P0-10 shell placeholder. F-1 scope: document list +
 * upload from camera/gallery/files. Folders, search, and bulk ops
 * arrive with F-9/F-11/F-25.
 */
import { IonContent, IonPage, IonToast } from '@ionic/react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ProgressBar } from '@kagaz/ui';
import { DocumentListItem } from '../components/DocumentListItem';
import { EmptyVaultState } from '../components/EmptyVaultState';
import { UploadFAB } from '../components/UploadFAB';
import { UploadOptionsSheet } from '../components/UploadOptionsSheet';
import { useDocuments } from '../hooks/useDocuments';
import { useUpload } from '../hooks/useUpload';
import { useVaultStore } from '../store/vault.store';
import type { UploadSource } from '../services/upload-sources';
import './vault.css';

/** Main vault screen: list + upload (F-1). */
export function VaultHomePage(): ReactNode {
  const { t } = useTranslation('documents');
  const { documents, isLoading } = useDocuments();
  const { isReady, uploadFrom } = useUpload();
  const isUploading = useVaultStore((state) => state.isUploading);
  const uploadProgress = useVaultStore((state) => state.uploadProgress);
  const isSheetOpen = useVaultStore((state) => state.isUploadSheetOpen);
  const lastUploadErrors = useVaultStore((state) => state.lastUploadErrors);
  const openSheet = useVaultStore((state) => state.openUploadSheet);
  const closeSheet = useVaultStore((state) => state.closeUploadSheet);
  const [uploadedCount, setUploadedCount] = useState(0);

  const handleSelectSource = (source: UploadSource): void => {
    void uploadFrom(source).then(({ uploaded }) => {
      setUploadedCount(uploaded);
    });
  };

  const listState = isLoading
    ? 'loading'
    : documents.length === 0
      ? 'idle'
      : 'success';

  return (
    <IonPage data-agent-id="vault.home">
      <IonContent>
        <main className="kg-vault" data-agent-id="vault.home.content">
          <h1>{t('title')}</h1>

          {isUploading && (
            <div
              className="kg-vault__progress"
              data-agent-id="vault.home.upload-progress"
              data-agent-state="loading"
            >
              <ProgressBar
                value={uploadProgress?.progress ?? 0}
                aria-label={t('upload.progress_label')}
                showLabel
              />
            </div>
          )}

          {!isLoading && documents.length === 0 ? (
            <EmptyVaultState />
          ) : (
            <ul
              className="kg-vault__list"
              data-agent-id="vault.home.list"
              data-agent-state={listState}
            >
              {documents.map((document) => (
                <DocumentListItem key={document.id} document={document} />
              ))}
            </ul>
          )}
        </main>

        <UploadFAB disabled={!isReady || isUploading} onClick={openSheet} />
        <UploadOptionsSheet
          isOpen={isSheetOpen}
          onDismiss={closeSheet}
          onSelect={handleSelectSource}
        />

        <IonToast
          isOpen={uploadedCount > 0}
          duration={2500}
          message={t('upload.success', { count: uploadedCount })}
          onDidDismiss={() => setUploadedCount(0)}
          data-agent-id="vault.home.upload-success-toast"
        />
        <IonToast
          isOpen={lastUploadErrors.length > 0}
          duration={4000}
          color="danger"
          message={lastUploadErrors.map((key) => t(key)).join('\n')}
          onDidDismiss={() => useVaultStore.getState().finishUpload([])}
          data-agent-id="vault.home.upload-error-toast"
        />
      </IonContent>
    </IonPage>
  );
}

export default VaultHomePage;
