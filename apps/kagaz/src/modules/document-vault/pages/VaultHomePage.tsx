/**
 * Vault home (02-document-vault-module.md §Module File Structure) —
 * replaces the P0-10 shell placeholder. F-1 scope: document list +
 * upload from camera/gallery/files. Folders, search, and bulk ops
 * arrive with F-9/F-11/F-25.
 */
import {
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
import { ActionSheet, Alert, Button, Icon, ProgressBar } from '@kagaz/ui';
import {
  hapticAction,
  hapticDestructive,
  hapticSuccess,
  hapticTap,
} from '@/core/haptics';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { DocumentListItem } from '../components/DocumentListItem';
import { BulkActionBar } from '../components/BulkActionBar';
import { EmptyVaultState } from '../components/EmptyVaultState';
import { FilterPanel } from '../components/FilterPanel';
import { FolderBreadcrumb } from '../components/FolderBreadcrumb';
import { FolderCard } from '../components/FolderCard';
import { FolderColorPicker } from '../components/FolderColorPicker';
import { MoveToFolderDialog } from '../components/MoveToFolderDialog';
import { NewFolderDialog } from '../components/NewFolderDialog';
import { RecentStrip } from '../components/RecentStrip';
import { SortControl } from '../components/SortControl';
import { TagSelector } from '../components/TagSelector';
import { ViewModeControl } from '../components/ViewModeControl';
import { UploadFAB } from '../components/UploadFAB';
import { UploadOptionsSheet } from '../components/UploadOptionsSheet';
import { useBulkActions } from '../hooks/useBulkActions';
import { useDocLock } from '../hooks/useDocLock';
import { canOcr, useDocumentOcr } from '../hooks/useDocumentOcr';
import { useDocumentIntents } from '../hooks/useDocumentIntents';
import { useCopyDocumentText } from '../hooks/useCopyDocumentText';
import {
  canConvertImageFormat,
  conversionTargetsFor,
  useImageFormatConversion,
} from '../hooks/useImageFormatConversion';
import type { CanvasFormat } from '@/modules/image-engine/types/image.types';
import { canApplyImageFilter, useImageEnhancement } from '../hooks/useImageEnhancement';
import { FILTER_PRESETS, type FilterPreset } from '@/modules/image-engine/services/image-filters';
import { DocumentDetailsSheet } from '../components/DocumentDetailsSheet';
import { ResizeCompressSheet } from '../components/ResizeCompressSheet';
import { PdfPageImageSheet } from '../components/PdfPageImageSheet';
import { PdfExtractPagesSheet } from '../components/PdfExtractPagesSheet';
import { isPdf } from '../hooks/useDocumentFile';
import { usePdfEngine } from '@/modules/pdf-engine/hooks/usePdfEngine';
import { useDocuments } from '../hooks/useDocuments';
import { useFolders } from '../hooks/useFolders';
import { useRecentDocuments } from '../hooks/useRecentDocuments';
import { useTags } from '../hooks/useTags';
import { useUpload } from '../hooks/useUpload';
import { useViewMode } from '../hooks/useViewMode';
import { useVaultMutations } from '../hooks/useVaultMutations';
import { FOLDER_TEMPLATES } from '../services/folder-templates';
import { SearchBar } from '@/modules/search/components/SearchBar';
import { useSearch } from '@/modules/search/hooks/useSearch';
import { MicButton } from '@/modules/ai-assistant/components/MicButton';
import {
  activeFilterCount,
  applyFilters,
} from '../services/filter.service';
import type {
  DocumentEntity,
  FolderEntity,
} from '@/infrastructure/database/types';
import { useVaultStore } from '../store/vault.store';
import { usePreferencesStore } from '@/core/preferences';
import type { UploadSource } from '../services/upload-sources';
import './vault.css';

/** Main vault screen: list + upload (F-1). */
export function VaultHomePage(): ReactNode {
  const { t } = useTranslation('documents');
  const router = useIonRouter();
  const { status: dbStatus } = useDatabase();
  const { documents, isLoading } = useDocuments();
  const { isReady, uploadFrom } = useUpload();
  const { toggleFavorite, markAccessed, rename, softDelete, restore } =
    useVaultMutations();
  // UX-8: prompt to rename each just-added document (unless disabled in Settings).
  const renameOnAdd = usePreferencesStore((s) => s.renameOnAdd);
  const { toggleLock, authorizeView } = useDocLock();
  const { extractText } = useDocumentOcr();
  const intents = useDocumentIntents();
  const copyText = useCopyDocumentText();
  const imageConvert = useImageFormatConversion();
  const imageEnhance = useImageEnhancement();
  const pdfEngine = usePdfEngine();
  const { mode: viewMode, setMode: setViewMode } = useViewMode();
  const recent = useRecentDocuments();
  const { tags, tagsByDocument, createTag, assignTag, removeTag } = useTags();
  const {
    folders,
    createFolder,
    renameFolder,
    updateFolderColor,
    reorderFolder,
    deleteFolder,
    moveDocument,
    createDefaultFolders,
  } = useFolders();

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
  const [convertDoc, setConvertDoc] = useState<DocumentEntity | null>(null);
  const [enhanceDoc, setEnhanceDoc] = useState<DocumentEntity | null>(null);
  const [resizeDoc, setResizeDoc] = useState<DocumentEntity | null>(null);
  const [pageImageDoc, setPageImageDoc] = useState<DocumentEntity | null>(null);
  const [extractPagesDoc, setExtractPagesDoc] = useState<DocumentEntity | null>(null);
  // F-9: folder options sheet (rename/change color/reorder/delete).
  const [moreFolder, setMoreFolder] = useState<FolderEntity | null>(null);
  const [colorFolder, setColorFolder] = useState<FolderEntity | null>(null);
  const [renameFolderTarget, setRenameFolderTarget] =
    useState<FolderEntity | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] =
    useState<FolderEntity | null>(null);
  const [ocrMsg, setOcrMsg] = useState<string | null>(null);
  // UX-1: the just-deleted document, kept so the toast can offer Undo (restore).
  const [deletedDoc, setDeletedDoc] = useState<DocumentEntity | null>(null);
  const [detailsDoc, setDetailsDoc] = useState<DocumentEntity | null>(null);
  const [isNewFolderOpen, setNewFolderOpen] = useState(false);

  // F-20: OCR an image document, then toast the outcome (text is stored, not shown).
  const handleOcr = async (document: DocumentEntity): Promise<void> => {
    const text = await extractText(document);
    if (text !== null && text.trim()) hapticSuccess();
    setOcrMsg(text === null ? t('ocr.failed') : text.trim() ? t('ocr.done') : t('ocr.none'));
  };
  // F-64/F-65: hand a document to another app; toast only on a real failure.
  const handleOpenWith = async (document: DocumentEntity): Promise<void> => {
    if (!(await intents.openWith(document))) setOcrMsg(t('intents.open_failed'));
  };
  const handleShareDoc = async (document: DocumentEntity): Promise<void> => {
    if (!(await intents.share(document))) setOcrMsg(t('intents.share_failed'));
  };
  // F-65 bulk-select follow-up: share every selected document in one sheet.
  const handleBulkShare = async (): Promise<void> => {
    const selected = documents.filter((d) => selectedIds.includes(d.id));
    const ok = await intents.shareMany(selected);
    clearSelection();
    if (!ok) setOcrMsg(t('intents.share_failed_bulk'));
  };
  // F-5 UX follow-up: one-tap compress at the recommended default quality — no sheet, no
  // extra taps (the item-menu already IS the picker; a quality choice is a
  // power-user path still available via the Tools hub). Same silent-until-done
  // toast convention as handleOcr/handleCopyText below (no in-progress state
  // shown mid-run — an existing app-wide convention, not new here).
  const handleCompressPdf = async (document: DocumentEntity): Promise<void> => {
    const saved = await pdfEngine.compressPdf(document, 'medium');
    setOcrMsg(t(saved > 0 ? 'pdf_compress.done' : 'pdf_compress.failed'));
  };
  // F-68: quick-copy a document's stored OCR/extracted text to the clipboard.
  const handleCopyText = async (document: DocumentEntity): Promise<void> => {
    setOcrMsg(t((await copyText.copy(document)) ? 'copy_text.copied' : 'copy_text.failed'));
  };
  // F-8: convert an image to another Canvas format, saved as a new document.
  const handleConvertFormat = async (
    document: DocumentEntity,
    target: CanvasFormat
  ): Promise<void> => {
    setOcrMsg(
      t(
        (await imageConvert.convert(document, target))
          ? 'convert_format.done'
          : 'convert_format.failed'
      )
    );
  };
  // F-29: apply an image-filter preset, saved as a new document.
  const handleApplyFilter = async (
    document: DocumentEntity,
    preset: FilterPreset
  ): Promise<void> => {
    setOcrMsg(
      t(
        (await imageEnhance.applyFilter(document, preset))
          ? 'enhance.done'
          : 'enhance.failed'
      )
    );
  };
  // F-9: folder options (rename/change color/reorder/delete).
  const handleDeleteFolder = async (folder: FolderEntity): Promise<void> => {
    await deleteFolder(folder.id);
    setDeleteFolderTarget(null);
  };
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
  // Shown when opening a locked document is declined at the biometric prompt.
  const [showLockedToast, setShowLockedToast] = useState(false);
  // UX-8: documents awaiting a rename prompt, oldest first (one alert at a time).
  const [renameQueue, setRenameQueue] = useState<DocumentEntity[]>([]);
  const renameTarget = renameQueue[0] ?? null;

  const handleSelectSource = (source: UploadSource): void => {
    void uploadFrom(source).then(({ uploaded, documents }) => {
      setUploadedCount(uploaded);
      // UX-8: queue the new docs for a name prompt, pre-filled with the default.
      if (renameOnAdd && documents.length > 0) {
        setRenameQueue(documents);
      }
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

  // Opening a document records recency (F-32) and navigates to the viewer
  // (UX-6). [SEC] §3.1: authorize a locked document here — the entry point —
  // before navigating; the viewer trusts that gate.
  const handleOpen = (document: DocumentEntity): void => {
    void authorizeView(document).then((allowed) => {
      if (!allowed) {
        setShowLockedToast(true);
        return;
      }
      void markAccessed(document);
      router.push(`/doc/${document.id}`);
    });
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
            <Button
              variant="ghost"
              size="sm"
              icon={<Icon name="FileText" size={24} />}
              onClick={() => router.push('/pdf-tools', 'forward', 'push')}
              agentId="vault.home.pdf-tools"
              agentAction="tools.openPdfTools"
            >
              {t('pdf_tools')}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<Icon name="KeyRound" size={24} />}
              aria-label={t('quick_reference.title')}
              onClick={() => router.push('/quick-reference', 'forward', 'push')}
              agentId="vault.home.quick-reference"
              agentAction="vault.openQuickReference"
            />
            <Button
              variant="ghost"
              size="sm"
              iconOnly
              icon={<Icon name="Settings" size={24} />}
              aria-label={t('settings')}
              onClick={() => router.push('/settings', 'forward', 'push')}
              agentId="vault.home.settings"
              agentAction="settings.open"
            />
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
              <div className="kg-vault__search-row">
                <SearchBar value={search.query} onChange={search.setQuery} />
                {/* F-15: hold-to-speak dictation into the search box. */}
                <MicButton onResult={search.setQuery} onPartial={search.setQuery} />
              </div>

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
                    className={`kg-vault__list kg-vault__list--${viewMode}`}
                    data-agent-id="vault.home.search-results"
                    data-agent-state={search.isSearching ? 'loading' : 'success'}
                  >
                    {visibleDocuments.map((document) => (
                      <DocumentListItem
                        key={document.id}
                        document={document}
                        tags={tagsByDocument.get(document.id) ?? []}
                        onOpen={handleOpen}
                        onToggleFavorite={(doc) => { hapticTap(); void toggleFavorite(doc); }}
                        onMore={(doc) => setMoreDoc(doc)}
                        selectionMode={selectionMode}
                        selected={selectedIds.includes(document.id)}
                        onToggleSelect={(doc) => toggleSelection(doc.id)}
                        onLongPress={(doc) => { hapticAction(); enterSelection(doc.id); }}
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
                          <FolderCard
                            folder={folder}
                            onOpen={enterFolder}
                            onMore={setMoreFolder}
                          />
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
                      {/* UX-7: List / Grid / Compact, persisted across launches. */}
                      <ViewModeControl mode={viewMode} onChange={setViewMode} />
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
                    className={`kg-vault__list kg-vault__list--${viewMode}`}
                    data-agent-id="vault.home.list"
                    data-agent-state={listState}
                  >
                    {filteredDocuments.map((document) => (
                      <DocumentListItem
                        key={document.id}
                        document={document}
                        tags={tagsByDocument.get(document.id) ?? []}
                        onOpen={handleOpen}
                        onToggleFavorite={(doc) => { hapticTap(); void toggleFavorite(doc); }}
                        onMore={(doc) => setMoreDoc(doc)}
                        selectionMode={selectionMode}
                        selected={selectedIds.includes(document.id)}
                        onToggleSelect={(doc) => toggleSelection(doc.id)}
                        onLongPress={(doc) => { hapticAction(); enterSelection(doc.id); }}
                      />
                    ))}
                  </ul>
                  )}
                </>
              )}
            </>
          )}
        </main>

        {/* Hidden during selection mode — it overlaps BulkActionBar's
           right-aligned actions (both are bottom-right-anchored fixed
           elements); one primary action at a time, per design-principles.md
           #1, same as the bottom nav hiding in selection mode. */}
        {!selectionMode && (
          <UploadFAB disabled={!isReady || isUploading} onClick={openSheet} />
        )}
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
        <TagSelector
          documentId={tagDocId}
          onDismiss={() => setTagDocId(null)}
          tags={tags}
          tagsByDocument={tagsByDocument}
          createTag={createTag}
          assignTag={assignTag}
          removeTag={removeTag}
        />
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
        <DocumentDetailsSheet document={detailsDoc} onClose={() => setDetailsDoc(null)} />

        <ResizeCompressSheet document={resizeDoc} onClose={() => setResizeDoc(null)} />
        <PdfPageImageSheet
          document={pageImageDoc}
          onClose={() => setPageImageDoc(null)}
        />
        <PdfExtractPagesSheet
          document={extractPagesDoc}
          onClose={() => setExtractPagesDoc(null)}
        />

        <ActionSheet
          isOpen={moreDoc !== null}
          header={moreDoc?.name}
          agentId="vault.home.item-menu"
          onDidDismiss={() => setMoreDoc(null)}
          buttons={[
            {
              text: t('actions.add_tag'),
              icon: 'Tag',
              handler: (): void => {
                if (moreDoc) setTagDocId(moreDoc.id);
              },
            },
            {
              text: t('folders.move'),
              icon: 'Move',
              handler: (): void => {
                if (moreDoc) setMoveDocId(moreDoc.id);
              },
            },
            {
              text: t('bulk.select'),
              icon: 'SquareCheck',
              handler: (): void => {
                if (moreDoc) enterSelection(moreDoc.id);
              },
            },
            {
              text: t(moreDoc?.isLocked ? 'actions.unlock' : 'actions.lock'),
              icon: moreDoc?.isLocked ? 'Unlock' : 'Lock',
              handler: (): void => {
                if (moreDoc) {
                  hapticTap();
                  void toggleLock(moreDoc);
                }
              },
            },
            // F-64/F-65: open in / share with another app (native only).
            ...(intents.supported
              ? [
                  {
                    text: t('intents.open_with'),
                    icon: 'ExternalLink' as const,
                    handler: (): void => {
                      if (moreDoc) void handleOpenWith(moreDoc);
                    },
                  },
                  {
                    text: t('intents.share'),
                    icon: 'Share2' as const,
                    handler: (): void => {
                      if (moreDoc) void handleShareDoc(moreDoc);
                    },
                  },
                ]
              : []),
            // F-67: read-only document details.
            {
              text: t('details.title'),
              icon: 'Info',
              handler: (): void => {
                if (moreDoc) setDetailsDoc(moreDoc);
              },
            },
            // F-68: quick-copy text, only when the doc already has stored text.
            ...(moreDoc && copyText.hasText(moreDoc)
              ? [
                  {
                    text: t('copy_text.action'),
                    icon: 'Copy' as const,
                    handler: (): void => {
                      if (moreDoc) void handleCopyText(moreDoc);
                    },
                  },
                ]
              : []),
            // F-8: convert an image to another Canvas format (JPEG/PNG/WebP).
            ...(moreDoc && canConvertImageFormat(moreDoc)
              ? [
                  {
                    text: t('convert_format.action'),
                    icon: 'FileType' as const,
                    handler: (): void => {
                      if (moreDoc) setConvertDoc(moreDoc);
                    },
                  },
                ]
              : []),
            // F-29: image filter presets (grayscale/B&W/auto-enhance/invert).
            ...(moreDoc && canApplyImageFilter(moreDoc)
              ? [
                  {
                    text: t('enhance.action'),
                    icon: 'Sparkles' as const,
                    handler: (): void => {
                      if (moreDoc) setEnhanceDoc(moreDoc);
                    },
                  },
                ]
              : []),
            // F-85: resize to exact dimensions + compress to a size target.
            ...(moreDoc && canConvertImageFormat(moreDoc)
              ? [
                  {
                    text: t('resize_compress.action'),
                    icon: 'Shrink' as const,
                    handler: (): void => {
                      if (moreDoc) setResizeDoc(moreDoc);
                    },
                  },
                ]
              : []),
            // F-5 UX follow-up: one-tap compress at the recommended quality —
            // the highest-frequency PDF tool (shrinking a scan under a
            // government-portal upload limit), promoted from the Tools-hub
            // tool-first flow straight onto the document it applies to.
            ...(moreDoc && isPdf(moreDoc.fileType)
              ? [
                  {
                    text: t('pdf_compress.action'),
                    icon: 'Shrink' as const,
                    handler: (): void => {
                      if (moreDoc) void handleCompressPdf(moreDoc);
                    },
                  },
                ]
              : []),
            // F-66 UX follow-up: same item-menu-first promotion as Compress —
            // extract selected pages into a new PDF, reusing F-86's page-range
            // sheet pattern.
            ...(moreDoc && isPdf(moreDoc.fileType)
              ? [
                  {
                    text: t('pdf_extract_pages.action'),
                    icon: 'Scissors' as const,
                    handler: (): void => {
                      if (moreDoc) setExtractPagesDoc(moreDoc);
                    },
                  },
                ]
              : []),
            // F-86: save selected page(s) of a PDF as standalone images.
            ...(moreDoc && isPdf(moreDoc.fileType)
              ? [
                  {
                    text: t('page_image.action'),
                    icon: 'Images' as const,
                    handler: (): void => {
                      if (moreDoc) setPageImageDoc(moreDoc);
                    },
                  },
                ]
              : []),
            // F-20: OCR only offered for image documents on a native platform.
            ...(moreDoc && canOcr(moreDoc)
              ? [
                  {
                    text: t('actions.extract_text'),
                    icon: 'FileText' as const,
                    handler: (): void => {
                      if (moreDoc) void handleOcr(moreDoc);
                    },
                  },
                ]
              : []),
            // UX-1: individual delete → soft-delete to Trash (recoverable via Undo).
            {
              text: t('actions.delete'),
              role: 'destructive',
              icon: 'Trash2',
              handler: (): void => {
                if (moreDoc) {
                  const doc = moreDoc;
                  hapticDestructive();
                  void softDelete(doc);
                  setDeletedDoc(doc);
                }
              },
            },
            { text: t('actions.cancel'), role: 'cancel' },
          ]}
        />

        {/* F-8: pick the target format after "Convert format" is chosen above. */}
        <ActionSheet
          isOpen={convertDoc !== null}
          header={t('convert_format.title')}
          agentId="vault.home.convert-format-sheet"
          onDidDismiss={() => setConvertDoc(null)}
          buttons={[
            ...(convertDoc
              ? conversionTargetsFor(convertDoc).map((target) => ({
                  text: t(`convert_format.to_${target}`),
                  icon: 'FileImage' as const,
                  handler: (): void => {
                    if (convertDoc) void handleConvertFormat(convertDoc, target);
                  },
                }))
              : []),
            { text: t('actions.cancel'), role: 'cancel' as const },
          ]}
        />

        {/* F-29: pick a filter preset after "Enhance photo" is chosen above. */}
        <ActionSheet
          isOpen={enhanceDoc !== null}
          header={t('enhance.title')}
          agentId="vault.home.enhance-sheet"
          onDidDismiss={() => setEnhanceDoc(null)}
          buttons={[
            ...(enhanceDoc
              ? (Object.keys(FILTER_PRESETS) as FilterPreset[]).map((preset) => ({
                  text: t(`enhance.preset_${preset}`),
                  icon: 'Filter' as const,
                  handler: (): void => {
                    if (enhanceDoc) void handleApplyFilter(enhanceDoc, preset);
                  },
                }))
              : []),
            { text: t('actions.cancel'), role: 'cancel' as const },
          ]}
        />

        {/* F-9: folder options — rename, change color, reorder, delete. */}
        <ActionSheet
          isOpen={moreFolder !== null}
          header={moreFolder?.name}
          agentId="vault.home.folder-menu"
          onDidDismiss={() => setMoreFolder(null)}
          buttons={[
            {
              text: t('actions.rename'),
              icon: 'Pencil',
              handler: (): void => {
                if (moreFolder) setRenameFolderTarget(moreFolder);
              },
            },
            {
              text: t('folders.change_color'),
              icon: 'Palette',
              handler: (): void => {
                if (moreFolder) setColorFolder(moreFolder);
              },
            },
            {
              text: t('folders.move_up'),
              icon: 'ChevronUp',
              handler: (): void => {
                if (moreFolder) void reorderFolder(moreFolder.id, -1);
              },
            },
            {
              text: t('folders.move_down'),
              icon: 'ChevronDown',
              handler: (): void => {
                if (moreFolder) void reorderFolder(moreFolder.id, 1);
              },
            },
            {
              text: t('actions.delete'),
              role: 'destructive' as const,
              icon: 'Trash2',
              handler: (): void => {
                if (moreFolder) setDeleteFolderTarget(moreFolder);
              },
            },
            { text: t('actions.cancel'), role: 'cancel' as const },
          ]}
        />

        <FolderColorPicker
          folder={colorFolder}
          onDismiss={() => setColorFolder(null)}
          onSelect={(color) => {
            if (colorFolder) void updateFolderColor(colorFolder.id, color);
            setColorFolder(null);
          }}
        />

        <Alert
          key={renameFolderTarget?.id ?? 'folder-rename-none'}
          isOpen={renameFolderTarget !== null}
          header={t('folders.rename_title')}
          agentId="vault.home.folder-rename-prompt"
          input={{
            label: t('folders.name_placeholder'),
            defaultValue: renameFolderTarget?.name ?? '',
          }}
          buttons={[
            { text: t('actions.cancel'), role: 'cancel' },
            {
              text: t('rename.save'),
              handler: (name?: string): void => {
                if (renameFolderTarget && name) {
                  void renameFolder(renameFolderTarget.id, name);
                }
              },
            },
          ]}
          onDidDismiss={() => setRenameFolderTarget(null)}
        />

        <Alert
          isOpen={deleteFolderTarget !== null}
          header={t('folders.delete_title')}
          message={t('folders.delete_message')}
          agentId="vault.home.folder-delete-confirm"
          buttons={[
            {
              text: t('actions.delete'),
              role: 'destructive',
              handler: (): void => {
                if (deleteFolderTarget) void handleDeleteFolder(deleteFolderTarget);
              },
            },
            { text: t('actions.cancel'), role: 'cancel' },
          ]}
          onDidDismiss={() => setDeleteFolderTarget(null)}
        />

        {selectionMode && (
          <BulkActionBar
            count={selectedIds.length}
            onCancel={clearSelection}
            onDelete={() => void bulkDelete()}
            onMove={() => setBulkMoveOpen(true)}
            onFavorite={() => void bulkFavorite()}
            onShare={intents.supported ? (): void => void handleBulkShare() : undefined}
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
          isOpen={ocrMsg !== null}
          duration={2500}
          message={ocrMsg ?? ''}
          onDidDismiss={() => setOcrMsg(null)}
          data-agent-id="vault.home.ocr-toast"
        />
        <IonToast
          isOpen={deletedDoc !== null}
          duration={4000}
          message={t('trash.moved_to_trash')}
          buttons={[
            {
              text: t('trash.undo'),
              handler: (): void => {
                if (deletedDoc) {
                  void restore(deletedDoc);
                }
              },
            },
          ]}
          onDidDismiss={() => setDeletedDoc(null)}
          data-agent-id="vault.home.delete-toast"
        />
        <IonToast
          isOpen={showLockedToast}
          duration={2500}
          message={t('lock.blocked')}
          onDidDismiss={() => setShowLockedToast(false)}
          data-agent-id="vault.home.locked-toast"
        />
        {/* UX-8: rename-on-add prompt, pre-filled with the default name. Keeping
           the default (Skip) stores it as-is. Keyed per document so each
           queued doc re-seeds the input. */}
        <Alert
          key={renameTarget?.id ?? 'rename-none'}
          isOpen={renameTarget !== null}
          header={t('rename.title')}
          agentId="vault.home.rename-prompt"
          input={{
            label: t('rename.label'),
            defaultValue: renameTarget?.name ?? '',
          }}
          buttons={[
            { text: t('rename.skip'), role: 'cancel' },
            {
              text: t('rename.save'),
              handler: (name?: string): void => {
                if (renameTarget && name) {
                  void rename(renameTarget, name);
                }
              },
            },
          ]}
          onDidDismiss={() => setRenameQueue((q) => q.slice(1))}
        />
      </IonContent>
    </IonPage>
  );
}

export default VaultHomePage;
