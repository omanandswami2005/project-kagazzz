/**
 * Vault home (02-document-vault-module.md §Module File Structure) —
 * replaces the P0-10 shell placeholder. F-1 scope: document list +
 * upload from camera/gallery/files. Folders, search, and bulk ops
 * arrive with F-9/F-11/F-25.
 */
import {
  IonActionSheet,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToast,
  IonToolbar,
  useIonRouter,
} from '@ionic/react';
import { Capacitor } from '@capacitor/core';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, ProgressBar } from '@kagaz/ui';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { DocumentListItem } from '../components/DocumentListItem';
import { BulkActionBar } from '../components/BulkActionBar';
import { EmptyVaultState } from '../components/EmptyVaultState';
import { FilterPanel } from '../components/FilterPanel';
import { FolderBreadcrumb } from '../components/FolderBreadcrumb';
import { FolderCard } from '../components/FolderCard';
import { MoveToFolderDialog } from '../components/MoveToFolderDialog';
import { NewFolderDialog } from '../components/NewFolderDialog';
import { RecentStrip } from '../components/RecentStrip';
import { SortControl } from '../components/SortControl';
import { TagSelector } from '../components/TagSelector';
import { UploadFAB } from '../components/UploadFAB';
import { UploadOptionsSheet } from '../components/UploadOptionsSheet';
import { useBulkActions } from '../hooks/useBulkActions';
import { useDocuments } from '../hooks/useDocuments';
import { useFolders } from '../hooks/useFolders';
import { useRecentDocuments } from '../hooks/useRecentDocuments';
import { useTags } from '../hooks/useTags';
import { useUpload } from '../hooks/useUpload';
import { useVaultMutations } from '../hooks/useVaultMutations';
import { FOLDER_TEMPLATES } from '../services/folder-templates';
import { SearchBar } from '@/modules/search/components/SearchBar';
import { useSearch } from '@/modules/search/hooks/useSearch';
import {
  activeFilterCount,
  applyFilters,
} from '../services/filter.service';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useVaultStore } from '../store/vault.store';
import type { UploadSource } from '../services/upload-sources';
import './vault.css';

/** Main vault screen: list + upload (F-1). */
export function VaultHomePage(): ReactNode {
  const { t } = useTranslation('documents');
  const ionRouter = useIonRouter();
  const { status: dbStatus } = useDatabase();
  const { documents, isLoading } = useDocuments();
  const { isReady, uploadFrom } = useUpload();
  const { toggleFavorite, markAccessed } = useVaultMutations();
  const recent = useRecentDocuments();
  const { tags, tagsByDocument } = useTags();
  const { folders, createFolder, moveDocument, createDefaultFolders } =
    useFolders();

  // F-30: localized starter folders, created from the empty state.
  const setUpStarterFolders = (): void => {
    void createDefaultFolders(
      FOLDER_TEMPLATES.map((tpl) => ({
        name: t(tpl.labelKey),
        icon: tpl.icon,
        color: tpl.color,
      }))
    );
  };
  const filters = useVaultStore((s) => s.filters);
  const setFilters = useVaultStore((s) => s.setFilters);
  const selectionMode = useVaultStore((s) => s.selectionMode);
  const selectedIds = useVaultStore((s) => s.selectedIds);
  const enterSelection = useVaultStore((s) => s.enterSelection);
  const toggleSelection = useVaultStore((s) => s.toggleSelection);
  const clearSelection = useVaultStore((s) => s.clearSelection);
  const { bulkDelete, bulkMove, bulkFavorite } = useBulkActions();
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [isFilterOpen, setFilterOpen] = useState(false);
  const filterCount = activeFilterCount(filters);
  // Filters apply to the current folder's documents (after sort).
  const filteredDocuments = applyFilters(documents, filters, tagsByDocument);
  const folderPath = useVaultStore((s) => s.folderPath);
  const enterFolder = useVaultStore((s) => s.enterFolder);
  const goToFolderDepth = useVaultStore((s) => s.goToFolderDepth);
  const [tagDocId, setTagDocId] = useState<string | null>(null);
  const [moveDocId, setMoveDocId] = useState<string | null>(null);
  const [moreDoc, setMoreDoc] = useState<DocumentEntity | null>(null);
  const [isNewFolderOpen, setNewFolderOpen] = useState(false);
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

  // Android hardware back inside a folder pops one level (folder nav is
  // store state, not a route, so Ionic's router back can't see it).
  // Priority 10: above the app's route/exit handler (5) and above Ionic's
  // own navigation handler (0) — Ionic's exits without chaining, so any
  // folder handler below 0 would never run. When no folder is open we
  // call next() to defer to the lower-priority handlers.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return undefined;
    }
    const onBack = (event: Event): void => {
      (
        event as CustomEvent<{
          register: (
            priority: number,
            handler: (next: () => void) => void
          ) => void;
        }>
      ).detail.register(10, (next) => {
        const state = useVaultStore.getState();
        if (state.folderPath.length > 0) {
          state.goToFolderDepth(state.folderPath.length - 1);
        } else {
          next();
        }
      });
    };
    document.addEventListener('ionBackButton', onBack);
    return (): void => document.removeEventListener('ionBackButton', onBack);
  }, []);

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
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('title')}</IonTitle>
          <IonButtons slot="end">
            <IonButton
              aria-label={t('storage.title')}
              data-agent-id="vault.home.storage-link"
              onClick={() => ionRouter.push('/storage', 'forward', 'push')}
            >
              <Icon name="HardDrive" size={24} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <main className="kg-vault" data-agent-id="vault.home.content">

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

          {!isLoading &&
          documents.length === 0 &&
          folders.length === 0 &&
          folderPath.length === 0 ? (
            <EmptyVaultState onSetUpFolders={setUpStarterFolders} />
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
                        onMore={(doc) => setMoreDoc(doc)}
                        selectionMode={selectionMode}
                        selected={selectedIds.includes(document.id)}
                        onToggleSelect={(doc) => toggleSelection(doc.id)}
                      />
                    ))}
                  </ul>
                )
              ) : (
                <>
                  <FolderBreadcrumb
                    path={folderPath}
                    onNavigate={goToFolderDepth}
                  />

                  {folderPath.length === 0 && (
                    <RecentStrip documents={recent} onOpen={handleOpen} />
                  )}

                  <div className="kg-vault__folder-bar">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Icon name="FolderPlus" size={20} />}
                      onClick={() => setNewFolderOpen(true)}
                      agentId="vault.home.new-folder"
                      agentAction="vault.createFolder"
                    >
                      {t('folders.new')}
                    </Button>
                  </div>

                  {folders.length > 0 && (
                    <ul
                      className="kg-folder-grid"
                      data-agent-id="vault.home.folders"
                    >
                      {folders.map((folder) => (
                        <li key={folder.id}>
                          <FolderCard folder={folder} onOpen={enterFolder} />
                        </li>
                      ))}
                    </ul>
                  )}

                  {documents.length > 0 && (
                    <div className="kg-vault__controls">
                      <Button
                        variant={filterCount > 0 ? 'secondary' : 'ghost'}
                        size="sm"
                        icon={<Icon name="Filter" size={20} />}
                        onClick={() => setFilterOpen(true)}
                        agentId="vault.home.filter-button"
                        agentAction="vault.openFilters"
                      >
                        {filterCount > 0
                          ? t('filters.active', { count: filterCount })
                          : t('filters.title')}
                      </Button>
                      {documents.length > 1 && <SortControl />}
                    </div>
                  )}
                  {filteredDocuments.length === 0 && filterCount > 0 ? (
                    <p
                      className="kg-vault__no-results"
                      data-agent-id="vault.home.no-filter-results"
                    >
                      {t('filters.no_matches')}
                    </p>
                  ) : (
                  <ul
                    className="kg-vault__list"
                    data-agent-id="vault.home.list"
                    data-agent-state={listState}
                  >
                    {filteredDocuments.map((document) => (
                      <DocumentListItem
                        key={document.id}
                        document={document}
                        tags={tagsByDocument.get(document.id) ?? []}
                        onOpen={handleOpen}
                        onToggleFavorite={(doc) => void toggleFavorite(doc)}
                        onMore={(doc) => setMoreDoc(doc)}
                        selectionMode={selectionMode}
                        selected={selectedIds.includes(document.id)}
                        onToggleSelect={(doc) => toggleSelection(doc.id)}
                      />
                    ))}
                  </ul>
                  )}
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
        <FilterPanel
          key={isFilterOpen ? 'filter-open' : 'filter-closed'}
          isOpen={isFilterOpen}
          filters={filters}
          tags={tags}
          onDismiss={() => setFilterOpen(false)}
          onApply={(next) => {
            setFilters(next);
            setFilterOpen(false);
          }}
        />
        <TagSelector documentId={tagDocId} onDismiss={() => setTagDocId(null)} />
        <MoveToFolderDialog
          documentId={moveDocId}
          onDismiss={() => setMoveDocId(null)}
          onMove={(docId, folderId) => {
            void moveDocument(docId, folderId);
            setMoveDocId(null);
          }}
        />
        <NewFolderDialog
          isOpen={isNewFolderOpen}
          onDismiss={() => setNewFolderOpen(false)}
          onCreate={(name) => {
            void createFolder(name);
            setNewFolderOpen(false);
          }}
        />
        <IonActionSheet
          isOpen={moreDoc !== null}
          header={moreDoc?.name}
          data-agent-id="vault.home.item-menu"
          onDidDismiss={() => setMoreDoc(null)}
          buttons={[
            {
              text: t('actions.add_tag'),
              data: { action: 'tags' },
              handler: (): void => {
                if (moreDoc) setTagDocId(moreDoc.id);
              },
            },
            {
              text: t('folders.move'),
              data: { action: 'move' },
              handler: (): void => {
                if (moreDoc) setMoveDocId(moreDoc.id);
              },
            },
            {
              text: t('bulk.select'),
              data: { action: 'select' },
              handler: (): void => {
                if (moreDoc) enterSelection(moreDoc.id);
              },
            },
            { text: t('actions.cancel'), role: 'cancel' },
          ]}
        />

        {selectionMode && (
          <BulkActionBar
            count={selectedIds.length}
            onCancel={clearSelection}
            onDelete={() => void bulkDelete()}
            onMove={() => setBulkMoveOpen(true)}
            onFavorite={() => void bulkFavorite()}
          />
        )}
        <MoveToFolderDialog
          documentId={bulkMoveOpen ? '__bulk__' : null}
          onDismiss={() => setBulkMoveOpen(false)}
          onMove={(_docId, folderId) => {
            void bulkMove(folderId);
            setBulkMoveOpen(false);
          }}
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
