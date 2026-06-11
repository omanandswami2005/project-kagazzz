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
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { DocumentListItem } from '../components/DocumentListItem';
import { EmptyVaultState } from '../components/EmptyVaultState';
import { RecentStrip } from '../components/RecentStrip';
import { SortControl } from '../components/SortControl';
import { TagSelector } from '../components/TagSelector';
import { UploadFAB } from '../components/UploadFAB';
import { UploadOptionsSheet } from '../components/UploadOptionsSheet';
import { useDocuments } from '../hooks/useDocuments';
import { useRecentDocuments } from '../hooks/useRecentDocuments';
import { useTags } from '../hooks/useTags';
import { useUpload } from '../hooks/useUpload';
import { useVaultMutations } from '../hooks/useVaultMutations';
import { SearchBar } from '@/modules/search/components/SearchBar';
import { useSearch } from '@/modules/search/hooks/useSearch';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useVaultStore } from '../store/vault.store';
import type { UploadSource } from '../services/upload-sources';
import './vault.css';

/** Main vault screen: list + upload (F-1). */
export function VaultHomePage(): ReactNode {
  const { t } = useTranslation('documents');
  const { status: dbStatus } = useDatabase();
  const { documents, isLoading } = useDocuments();
  const { isReady, uploadFrom } = useUpload();
  const { toggleFavorite, markAccessed } = useVaultMutations();
  const recent = useRecentDocuments();
  const { tagsByDocument } = useTags();
  const [tagDocId, setTagDocId] = useState<string | null>(null);
  const search = useSearch();
  // While searching, results replace the folder/list view.
  const visibleDocuments = search.isActive ? search.results : documents;
  const isUploading = useVaultStore((state) => state.isUploading);
  const uploadProgress = useVaultStore((state) => state.uploadProgress);
  const isSheetOpen = useVaultStore((state) => state.isUploadSheetOpen);
  const lastUploadErrors = useVaultStore((state) => state.lastUploadErrors);
  const openSheet = useVaultStore((state) => state.openUploadSheet);
  const closeSheet = useVaultStore((state) => state.closeUploadSheet);
  const [uploadedCount, setUploadedCount] = useState(0);
  // Stopgap until F-24 ships document preview/detail: tapping a row tells
  // the user the feature is coming rather than appearing dead.
  const [showPreviewToast, setShowPreviewToast] = useState(false);

  const handleSelectSource = (source: UploadSource): void => {
    void uploadFrom(source).then(({ uploaded }) => {
      setUploadedCount(uploaded);
    });
  };

  // Opening a document records recency (F-32) and, until F-24 ships the
  // detail view, surfaces the "preview coming soon" stopgap.
  const handleOpen = (document: DocumentEntity): void => {
    void markAccessed(document);
    setShowPreviewToast(true);
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

          {dbStatus === 'error' && (
            <p
              className="kg-vault__db-error"
              role="alert"
              data-agent-id="vault.home.db-error"
              data-agent-state="error"
            >
              {t('banner.db_unavailable')}
            </p>
          )}

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
            <>
              <SearchBar value={search.query} onChange={search.setQuery} />

              {search.isActive ? (
                visibleDocuments.length === 0 && !search.isSearching ? (
                  <p
                    className="kg-vault__no-results"
                    data-agent-id="vault.home.no-results"
                  >
                    {t('search.no_results', { query: search.query })}
                  </p>
                ) : (
                  <ul
                    className="kg-vault__list"
                    data-agent-id="vault.home.search-results"
                    data-agent-state={search.isSearching ? 'loading' : 'success'}
                  >
                    {visibleDocuments.map((document) => (
                      <DocumentListItem
                        key={document.id}
                        document={document}
                        tags={tagsByDocument.get(document.id) ?? []}
                        onOpen={handleOpen}
                        onToggleFavorite={(doc) => void toggleFavorite(doc)}
                        onManageTags={(doc) => setTagDocId(doc.id)}
                      />
                    ))}
                  </ul>
                )
              ) : (
                <>
                  <RecentStrip documents={recent} onOpen={handleOpen} />
                  {documents.length > 1 && <SortControl />}
                  <ul
                    className="kg-vault__list"
                    data-agent-id="vault.home.list"
                    data-agent-state={listState}
                  >
                    {documents.map((document) => (
                      <DocumentListItem
                        key={document.id}
                        document={document}
                        tags={tagsByDocument.get(document.id) ?? []}
                        onOpen={handleOpen}
                        onToggleFavorite={(doc) => void toggleFavorite(doc)}
                        onManageTags={(doc) => setTagDocId(doc.id)}
                      />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </main>

        <UploadFAB disabled={!isReady || isUploading} onClick={openSheet} />
        <UploadOptionsSheet
          isOpen={isSheetOpen}
          onDismiss={closeSheet}
          onSelect={handleSelectSource}
        />
        <TagSelector documentId={tagDocId} onDismiss={() => setTagDocId(null)} />

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
        <IonToast
          isOpen={showPreviewToast}
          duration={2000}
          message={t('preview.coming_soon')}
          onDidDismiss={() => setShowPreviewToast(false)}
          data-agent-id="vault.home.preview-toast"
        />
      </IonContent>
    </IonPage>
  );
}

export default VaultHomePage;
