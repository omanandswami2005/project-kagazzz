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
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionSheet, Alert, Button, Icon, ProgressBar } from '@kagaz/ui';
import {
  hapticAction,
  hapticDestructive,
  hapticSuccess,
  hapticTap,
} from '@/core/haptics';
import { useAi } from '@/app/providers/AIProvider';
import { useDatabase } from '@/app/providers/DatabaseProvider';
import { UndoToast } from '@/core/components/UndoToast';
import type { SwipeActionKind } from '@/core/gestures';
import { searchPdfTools, type PdfOpMeta } from '@/core/pdf-tools-catalog';
import { VirtualDocumentList } from '../components/VirtualDocumentList';
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
import { pickFromGallery, type UploadSource } from '../services/upload-sources';
import type { IncomingFile } from '../types/document.types';
import './vault.css';

/** One queued, undo-able delete (bug-audit follow-up — see the `undoQueue` note below). */
type PendingUndo =
  | { kind: 'single'; document: DocumentEntity }
  | { kind: 'bulk'; documents: DocumentEntity[] };

/** Main vault screen: list + upload (F-1). */
export function VaultHomePage(): ReactNode {
  const { t } = useTranslation('documents');
  // UX pass 2026-07-24: vault search also surfaces a matching PDF Tool
  // (e.g. typing "merge" finds the Merge PDFs tool) — needs the `tools`
  // namespace's own t(), since PDF_OPS names/descriptions live there.
  const { t: tTools } = useTranslation('tools');
  const router = useIonRouter();
  const ai = useAi();
  // Virtualization support (UX pass, 2026-07-23): IonContent's scroll
  // element isn't a plain DOM ref, it's resolved async through its own API
  // — Ionic's documented pattern for wiring a scroll-position-dependent
  // library (like a virtualizer) to IonContent's real (shadow-DOM-internal)
  // scrollable element. Resolves once on mount; IonContent doesn't replace
  // its scroll element for the life of the component.
  const ionContentRef = useRef<HTMLIonContentElement>(null);
  const [scrollElement, setScrollElement] = useState<HTMLElement | null>(null);
  useEffect(() => {
    let cancelled = false;
    void ionContentRef.current?.getScrollElement().then((el) => {
      if (!cancelled) {
        setScrollElement(el);
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, []);
  const { status: dbStatus } = useDatabase();
  const { documents, isLoading } = useDocuments();
  const { isReady, uploadFrom, ingestFiles } = useUpload();
  const { toggleFavorite, rename, softDelete, restore, archive } =
    useVaultMutations();
  // UX-8: prompt to rename each just-added document (unless disabled in Settings).
  const renameOnAdd = usePreferencesStore((s) => s.renameOnAdd);
  // F-88: user-configured swipe-left/right actions (Settings → Swipe actions).
  const swipeLeftAction = usePreferencesStore((s) => s.swipeLeftAction);
  const swipeRightAction = usePreferencesStore((s) => s.swipeRightAction);
  const { toggleLock } = useDocLock();
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
  const [renameDocTarget, setRenameDocTarget] = useState<DocumentEntity | null>(null);
  // Swipe-to-delete confirms first — unlike the item-menu's delete (a
  // deliberate two-tap flow already safety-netted by the undo toast), a
  // swipe is easy to trigger by accident, so it gets an extra confirm step.
  const [swipeDeleteTarget, setSwipeDeleteTarget] = useState<DocumentEntity | null>(null);
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
  // UX-1/F-88, bug-audit follow-up: every delete (single or bulk) gets its
  // own undo opportunity, queued rather than held in one overwritable slot.
  // A single `deletedDoc`/`bulkDeletedDocs` pair meant a second delete
  // within the first one's 4s toast window silently clobbered it — the
  // toast stayed open the whole time with no visible change, but Undo only
  // ever restored the newer batch. Also fixes the single/bulk toasts being
  // able to render open simultaneously (each was its own unconditional
  // `<UndoToast>`) — there is now exactly one, showing the queue's head.
  const [undoQueue, setUndoQueue] = useState<PendingUndo[]>([]);
  const pendingUndo = undoQueue[0] ?? null;
  const enqueueUndo = (entry: PendingUndo): void =>
    setUndoQueue((queue) => [...queue, entry]);
  const dequeueUndo = (): void => setUndoQueue((queue) => queue.slice(1));
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
  // F-88: dispatches a swipe-committed action to the same handler the
  // row's own menu/star button already uses — swipe is purely an
  // accelerator over existing, individually-tested mutation paths.
  const handleSwipeAction = (
    document: DocumentEntity,
    kind: Exclude<SwipeActionKind, 'none'>
  ): void => {
    switch (kind) {
      case 'delete':
        setSwipeDeleteTarget(document);
        break;
      case 'favorite':
        hapticTap();
        void toggleFavorite(document);
        break;
      case 'move':
        setMoveDocId(document.id);
        break;
      case 'tags':
        setTagDocId(document.id);
        break;
      case 'archive':
        hapticTap();
        void archive(document);
        break;
    }
  };

  const search = useSearch();
  // While searching, results replace the folder/list view.
  const visibleDocuments = search.isActive ? search.results : documents;
  // UX pass 2026-07-24: surface a matching PDF Tool alongside document
  // results (e.g. "merge" → the Merge PDFs tool), not just documents.
  const matchingTools = useMemo<PdfOpMeta[]>(
    () => (search.isActive ? searchPdfTools(search.query, tTools) : []),
    [search.isActive, search.query, tTools]
  );
  const isUploading = useVaultStore((state) => state.isUploading);
  const uploadProgress = useVaultStore((state) => state.uploadProgress);
  const isSheetOpen = useVaultStore((state) => state.isUploadSheetOpen);
  const lastUploadErrors = useVaultStore((state) => state.lastUploadErrors);
  const openSheet = useVaultStore((state) => state.openUploadSheet);
  const closeSheet = useVaultStore((state) => state.closeUploadSheet);
  const [uploadedCount, setUploadedCount] = useState(0);
  // UX-8: documents awaiting a rename prompt, oldest first (one alert at a time).
  const [renameQueue, setRenameQueue] = useState<DocumentEntity[]>([]);
  const renameTarget = renameQueue[0] ?? null;
  // Device-testing ask: "multi select from gallery directly to pdf" — 2+
  // gallery photos offer combining into one PDF instead of N separate image
  // documents. Holds the just-picked files while that choice is pending.
  const [galleryFiles, setGalleryFiles] = useState<IncomingFile[] | null>(null);

  const finishUpload = ({ uploaded, documents }: { uploaded: number; documents: DocumentEntity[] }): void => {
    setUploadedCount(uploaded);
    // UX-8: queue the new docs for a name prompt, pre-filled with the default.
    if (renameOnAdd && documents.length > 0) {
      setRenameQueue(documents);
    }
  };

  const handleSelectSource = (source: UploadSource): void => {
    // Gallery is special-cased: with 2+ photos picked, ask whether to
    // combine them into one PDF (pdfEngine.imagesToPdfFromFiles) before
    // they're ever persisted as separate documents. uploadFrom() closes the
    // sheet itself; bypassing it here means doing that ourselves below.
    if (source === 'gallery') {
      useVaultStore.getState().closeUploadSheet();
      void pickFromGallery().then((files) => {
        if (files.length > 1) {
          setGalleryFiles(files);
          return;
        }
        void ingestFiles(files).then(finishUpload);
      });
      return;
    }
    void uploadFrom(source).then(finishUpload);
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

  // Opens the viewer (UX-6). [SEC] §3.1, bug-audit hardening: the per-doc
  // lock gate + recency stamp (F-32) used to live only here — every other
  // way of reaching /doc/:id trusted this call site by convention, a
  // single point of failure. DocumentViewerPage now enforces its own gate
  // (and stamps markAccessed itself on success), so this is a plain
  // navigate; see DocumentViewerPage's own [SEC] comment.
  const handleOpen = (document: DocumentEntity): void => {
    router.push(`/doc/${document.id}`);
  };

  // UX pass 2026-07-25: the FAB drawer's Quick Note item — jumps straight
  // into the add-note composer instead of landing on the list (that's what
  // the header's Quick Notes icon already does). QuickNotesPage reads the
  // `new` query param once on mount and opens the composer for it.
  const handleQuickNote = (): void => {
    router.push('/quick-notes?new=1', 'forward', 'push');
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
            {ai.status !== 'unsupported' && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={<Icon name="Sparkles" size={24} />}
                aria-label={t('title', { ns: 'ai-assistant' })}
                onClick={() => router.push('/ai-chat', 'forward', 'push')}
                agentId="vault.home.ai-chat"
              />
            )}
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
              icon={<Icon name="StickyNote" size={24} />}
              aria-label={t('quick_notes.title')}
              onClick={() => router.push('/quick-notes', 'forward', 'push')}
              agentId="vault.home.quick-notes"
              agentAction="vault.openQuickNotes"
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
      <IonContent ref={ionContentRef}>
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
                <>
                  {matchingTools.length > 0 && (
                    <ul
                      className="kg-vault__tool-matches"
                      data-agent-id="vault.home.tool-matches"
                    >
                      {matchingTools.map((op) => (
                        <li key={op.id}>
                          <button
                            type="button"
                            className="kg-vault__tool-match"
                            onClick={() => router.push('/pdf-tools', 'forward', 'push')}
                            data-agent-id={`vault.home.tool-match-${op.id}`}
                          >
                            <Icon name={op.icon} size={20} aria-hidden />
                            <span>{tTools(`ops.${op.id}`)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {visibleDocuments.length === 0 && matchingTools.length === 0 && !search.isSearching ? (
                    <p
                      className="kg-vault__no-results"
                      data-agent-id="vault.home.no-results"
                    >
                      {t('search.no_results', { query: search.query })}
                    </p>
                  ) : visibleDocuments.length > 0 || search.isSearching ? (
                    <VirtualDocumentList
                      documents={visibleDocuments}
                      viewMode={viewMode}
                      tagsByDocument={tagsByDocument}
                      scrollElement={scrollElement}
                      onOpen={handleOpen}
                      onToggleFavorite={(doc) => { hapticTap(); void toggleFavorite(doc); }}
                      onMore={(doc) => setMoreDoc(doc)}
                      selectionMode={selectionMode}
                      selectedIds={selectedIds}
                      onToggleSelect={(doc) => toggleSelection(doc.id)}
                      onLongPress={(doc) => { hapticAction(); enterSelection(doc.id); }}
                      swipeLeftAction={swipeLeftAction}
                      swipeRightAction={swipeRightAction}
                      onSwipeAction={handleSwipeAction}
                      agentId="vault.home.search-results"
                      agentState={search.isSearching ? 'loading' : 'success'}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <FolderBreadcrumb
                    path={folderPath}
                    onNavigate={goToFolderDepth}
                  />

                  {folderPath.length === 0 && (
                    <RecentStrip
                      documents={recent}
                      onOpen={handleOpen}
                      onOpenTools={() => router.push('/pdf-tools', 'forward', 'push')}
                      selectionMode={selectionMode}
                    />
                  )}

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
                  <VirtualDocumentList
                    documents={filteredDocuments}
                    viewMode={viewMode}
                    tagsByDocument={tagsByDocument}
                    scrollElement={scrollElement}
                    onOpen={handleOpen}
                    onToggleFavorite={(doc) => { hapticTap(); void toggleFavorite(doc); }}
                    onMore={(doc) => setMoreDoc(doc)}
                    selectionMode={selectionMode}
                    selectedIds={selectedIds}
                    onToggleSelect={(doc) => toggleSelection(doc.id)}
                    onLongPress={(doc) => { hapticAction(); enterSelection(doc.id); }}
                    swipeLeftAction={swipeLeftAction}
                    swipeRightAction={swipeRightAction}
                    onSwipeAction={handleSwipeAction}
                    agentId="vault.home.list"
                    agentState={listState}
                  />
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
          <UploadFAB
            disabled={!isReady || isUploading}
            onUpload={openSheet}
            onNewFolder={() => setNewFolderOpen(true)}
            onQuickNote={handleQuickNote}
          />
        )}
        <UploadOptionsSheet
          isOpen={isSheetOpen}
          onDismiss={closeSheet}
          onSelect={handleSelectSource}
        />
        {/* Device-testing ask: 2+ gallery photos ask whether to combine them
           into one PDF (pdfEngine.imagesToPdfFromFiles) or keep them as
           separate image documents (ingestFiles, today's default). */}
        <Alert
          isOpen={galleryFiles !== null}
          header={t('upload.combine_photos_title', { count: galleryFiles?.length ?? 0 })}
          agentId="vault.home.combine-photos-confirm"
          buttons={[
            {
              text: t('upload.keep_separate_action'),
              handler: (): void => {
                if (galleryFiles) void ingestFiles(galleryFiles).then(finishUpload);
              },
            },
            {
              text: t('upload.combine_action'),
              handler: (): void => {
                if (galleryFiles) {
                  void pdfEngine
                    .imagesToPdfFromFiles(galleryFiles)
                    .then((uploaded) => setUploadedCount(uploaded));
                }
              },
            },
          ]}
          onDidDismiss={() => setGalleryFiles(null)}
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
              text: t('actions.rename'),
              icon: 'Pencil',
              handler: (): void => {
                if (moreDoc) setRenameDocTarget(moreDoc);
              },
            },
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
            // F-89: hide from the main list without deleting — the item-menu
            // path for the same action Swipe Actions can bind to a side.
            {
              text: t('actions.archive'),
              icon: 'Archive',
              handler: (): void => {
                if (moreDoc) {
                  hapticTap();
                  void archive(moreDoc);
                }
              },
            },
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
                  enqueueUndo({ kind: 'single', document: doc });
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
            onDelete={() => {
              // F-88: capture the selected docs before bulkDelete() clears the
              // selection — it only reports a count, not which docs, and the
              // undo toast needs the full set to restore.
              const targets = documents.filter((d) => selectedIds.includes(d.id));
              hapticDestructive();
              void bulkDelete().then(() => enqueueUndo({ kind: 'bulk', documents: targets }));
            }}
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
        {/* UX-1/F-88, bug-audit follow-up: one toast for the undo queue's
           head — see the `undoQueue` state comment above for why this
           replaced two independent, clobber-prone/overlap-prone toasts. */}
        <UndoToast
          isOpen={pendingUndo !== null}
          message={
            pendingUndo?.kind === 'bulk'
              ? t('bulk.deleted', { count: pendingUndo.documents.length })
              : t('trash.moved_to_trash')
          }
          onUndo={() => {
            if (!pendingUndo) return;
            if (pendingUndo.kind === 'single') void restore(pendingUndo.document);
            else for (const doc of pendingUndo.documents) void restore(doc);
          }}
          onDidDismiss={dequeueUndo}
          agentId="vault.home.delete-toast"
        />
        {/* F-88 bug-audit: swipe-to-delete now confirms first — see the
           swipeDeleteTarget state doc comment. Reuses the same Alert
           primitive as every other delete confirm in this app. */}
        <Alert
          key={swipeDeleteTarget?.id ?? 'swipe-delete-none'}
          isOpen={swipeDeleteTarget !== null}
          header={t('actions.delete_confirm_title', { name: swipeDeleteTarget?.name ?? '' })}
          message={t('actions.delete_confirm_message')}
          agentId="vault.home.swipe-delete-confirm"
          buttons={[
            {
              text: t('actions.delete'),
              role: 'destructive',
              handler: (): void => {
                if (swipeDeleteTarget) {
                  hapticDestructive();
                  void softDelete(swipeDeleteTarget);
                  enqueueUndo({ kind: 'single', document: swipeDeleteTarget });
                }
              },
            },
            { text: t('actions.cancel'), role: 'cancel' },
          ]}
          onDidDismiss={() => setSwipeDeleteTarget(null)}
        />
        {/* Rename a document from its item menu, any time (distinct from
           UX-8's rename-on-add queue below — "Cancel" not "Skip", and not
           gated behind renameOnAdd). Mirrors the folder-rename Alert above. */}
        <Alert
          key={renameDocTarget?.id ?? 'doc-rename-none'}
          isOpen={renameDocTarget !== null}
          header={t('rename.title')}
          agentId="vault.home.doc-rename-prompt"
          input={{
            label: t('rename.label'),
            defaultValue: renameDocTarget?.name ?? '',
          }}
          buttons={[
            { text: t('actions.cancel'), role: 'cancel' },
            {
              text: t('rename.save'),
              handler: (name?: string): void => {
                if (renameDocTarget && name) {
                  void rename(renameDocTarget, name);
                }
              },
            },
          ]}
          onDidDismiss={() => setRenameDocTarget(null)}
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
