/**
 * Document viewer (UX-6) — the preview that F-24 deferred. Renders images and
 * PDF pages (via the pdf-engine's pdfjs path), and surfaces the **extracted
 * text** (OCR, F-20) so users can finally read/copy what OCR produced.
 *
 * [SEC] A per-document-locked file (§3.1) is authorized *here*, at the route
 * itself — not by convention at each caller. Bug-audit hardening: this used
 * to be enforced only by VaultHomePage/FavoritesPage calling authorizeView
 * before router.push, which worked only because those were the sole two
 * routes in; any future addition that pushes to /doc/:id (a search-result
 * shortcut, a notification, a restored browser-history entry) would have
 * silently bypassed the lock, since the viewer trusted its caller
 * unconditionally. Centralizing it here makes the gate structural instead
 * of conventional — a declined prompt goes back before any content renders,
 * and markAccessed (F-32) only stamps once authorization actually succeeds,
 * same as before. Extracted text is shown from the encrypted DB and copied
 * only on explicit user action.
 *
 * Trash preview (F-57 device-testing follow-up): `?trashed=1` on this same
 * route lets TrashPage open a soft-deleted document read-only, without
 * restoring it first. It loads via `useDocument(id, { trashed: true })` (→
 * the DAO's `findTrashedById`, the one query allowed behind
 * `deleted_at IS NULL`) and hides the actions that don't apply to a trashed
 * row — Share/Open-with (Trash isn't the place to hand the file to another
 * app) and the menu's Delete (Trash already owns restore/delete-forever, and
 * `softDelete` is a no-op on an already-trashed row anyway). `markAccessed`
 * is also skipped for a trashed preview — Recent already excludes trashed
 * documents, so stamping it would just be a wasted write. [SEC] The lock
 * gate below is untouched by the `trashed` branch — it reads
 * `document.isLocked` off whatever `useDocument` loaded, live or trashed, so
 * a document locked before being trashed still needs the same biometric
 * prompt here as it would live.
 */
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
  useIonRouter,
} from '@ionic/react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { VIEWER_TOUR, VIEWER_TOUR_TIP } from '@/app/onboarding/tour';
import { useFirstRunTour } from '@/app/onboarding/useFirstRunTour';
import { useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ActionSheet, Alert, Button, Icon } from '@kagaz/ui';
import { useDocument } from '../hooks/useDocument';
import { useDocLock } from '../hooks/useDocLock';
import { isPdf, useDocumentFile } from '../hooks/useDocumentFile';
import { useDocxHtml } from '../hooks/useDocxHtml';
import { canExtractText, canTranscribeWithVision, useDocumentOcr } from '../hooks/useDocumentOcr';
import { useDocumentIntents } from '../hooks/useDocumentIntents';
import { useAi } from '@/app/providers/AIProvider';
import { NextActions } from '@/core/components/NextActions';
import { detectIdNumbers } from '@/core/id-numbers';
import { NumberChip } from '../components/NumberChip';
import { usePageGestures } from '../hooks/usePageGestures';
import { useVaultStore } from '../store/vault.store';
import { offerQuickReferenceDraft } from '../store/quick-reference-draft';
import { documentTypeIcon, isImageFile } from '@/core/components/DocumentThumb';
import { askAiAboutRoute, pdfToolRoute } from '@/core/constants/routes';
import { copyToClipboard } from '@/core/clipboard';
import { hapticDestructive } from '@/core/haptics';
import { extractNumberSequences } from '../services/extract-numbers';
import { DocumentDetailsSheet } from '../components/DocumentDetailsSheet';
import { useVaultMutations } from '../hooks/useVaultMutations';
import './viewer.css';

/** Full-screen viewer for one document. */
export function DocumentViewerPage(): ReactNode {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('documents');
  const router = useIonRouter();
  const location = useLocation();
  // F-57 preview: `/doc/:id?trashed=1` from TrashPage — see the file's own
  // doc comment above.
  const trashed = useMemo(
    () => new URLSearchParams(location.search).get('trashed') === '1',
    [location.search]
  );
  const { document, loading } = useDocument(id, { trashed });
  const { pages, loading: fileLoading, error } = useDocumentFile(document);
  const { html: docxHtml, loading: docxLoading, error: docxError } = useDocxHtml(document);
  const isDocxDoc = document?.fileType.toLowerCase() === 'docx';
  const { extractText, runningId } = useDocumentOcr();
  const { softDelete, markAccessed, rename } = useVaultMutations();
  const { authorizeView } = useDocLock();
  const intents = useDocumentIntents();
  const ai = useAi();

  // Extracted text: the freshly-extracted override, else the stored OCR text.
  // Derived (no effect) so it stays in sync as the document loads.
  const [extracted, setExtracted] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // [SEC] §3.1, bug-audit hardening: the structural gate — see the file's
  // own doc comment above. `null` = not checked yet (or the id changed and
  // a re-check is pending), `true`/`false` = the last check's outcome.
  // Re-runs whenever the loaded document identity changes, not just once,
  // so navigating from one locked document straight to another
  // (hypothetically, via a future "next document" control) can't reuse a
  // stale `true` from the previous one.
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const checkedForId = useRef<string | null>(null);
  useEffect(() => {
    if (!document) {
      return;
    }
    if (checkedForId.current === document.id) {
      return;
    }
    checkedForId.current = document.id;
    let cancelled = false;
    void authorizeView(document).then((allowed) => {
      if (cancelled) {
        return;
      }
      setAuthorized(allowed);
      if (allowed) {
        // Trash preview: don't stamp last-accessed — Recent already excludes
        // trashed documents (findRecent filters deleted_at IS NULL), so this
        // would just be a no-op write for no observable benefit.
        if (!trashed) {
          void markAccessed(document);
        }
      } else {
        setToast(t('lock.blocked'));
        router.goBack();
      }
    });
    return (): void => {
      cancelled = true;
    };
  }, [document, authorizeView, markAccessed, router, t, trashed]);

  const text = extracted ?? document?.ocrText ?? null;
  // F-83: standalone number sequences (account/ID numbers, PIN codes, dates, …)
  // pulled out of the extracted text so one can be copied without drag-selecting
  // it out of the block — the full text is still selectable text (below).
  const detectedNumbers = useMemo(() => extractNumberSequences(text ?? ''), [text]);

  const running = document != null && runningId === document.id;
  // Which engine the in-flight extraction uses, so only its own button spins.
  const [runningEngine, setRunningEngine] = useState<'auto' | 'vision'>('auto');

  const handleExtract = async (engine: 'auto' | 'vision' = 'auto'): Promise<void> => {
    if (!document) {
      return;
    }
    setRunningEngine(engine);
    const out = await extractText(document, { engine });
    setExtracted(out);
    setToast(out === null ? t('ocr.failed') : out.trim() ? t('ocr.done') : t('ocr.none'));
  };

  const handleCopy = async (): Promise<void> => {
    if (text) {
      setToast((await copyToClipboard(text)) ? t('viewer.copied') : t('ocr.failed'));
    }
  };

  const handleCopyNumber = async (value: string): Promise<void> => {
    setToast((await copyToClipboard(value)) ? t('viewer.copied') : t('ocr.failed'));
  };

  const handleShare = async (): Promise<void> => {
    if (document && !(await intents.share(document))) {
      setToast(t('intents.share_failed'));
    }
  };

  const handleOpenWith = async (): Promise<void> => {
    if (document && !(await intents.openWith(document))) {
      setToast(t('intents.open_failed'));
    }
  };

  const handleDelete = (): void => {
    if (document) {
      hapticDestructive();
      void softDelete(document);
      router.goBack();
    }
  };

  // VW-10: swipe to the neighbouring document of the list you came from
  // (the vault's current list); zoom with pinch / double-tap.
  const listed = useVaultStore((st) => st.documents);
  const pageGestures = usePageGestures((direction) => {
    const at = listed.findIndex((d) => d.id === id);
    const next = at < 0 ? undefined : listed[direction === 'next' ? at + 1 : at - 1];
    if (next) router.push(`/doc/${next.id}`, direction === 'next' ? 'forward' : 'back', 'replace');
  });

  // First-run journey: the first opened document shows where swipe-to-next
  // and ⋮ are. The swipe step only when there is a next document to reach.
  const canSwipe = listed.length > 1;
  const viewerTour = useMemo(
    () => VIEWER_TOUR.filter((step) => step.key !== 'viewer_swipe' || canSwipe),
    [canSwipe]
  );
  useFirstRunTour(
    viewerTour,
    VIEWER_TOUR_TIP,
    authorized === true && !trashed && !loading && !fileLoading && !error && document !== null && !menuOpen
  );

  // VW-8: PDFs most often need shrinking for an upload limit; photos most
  // often need to become a PDF.
  const typeTool = !document
    ? null
    : isPdf(document.fileType)
      ? { id: 'compress', tool: 'compress', icon: 'Shrink' as const, labelKey: 'viewer.compress' as const }
      : isImageFile(document.fileType)
        ? { id: 'make-pdf', tool: 'imagesToPdf', icon: 'FileOutput' as const, labelKey: 'viewer.make_pdf' as const }
        : null;

  return (
    <IonPage data-agent-id="vault.viewer">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton
              defaultHref={trashed ? '/trash' : '/vault'}
              data-agent-id="vault.viewer.back"
            />
          </IonButtons>
          <IonTitle>{document?.name ?? ''}</IonTitle>
          <IonButtons slot="end">
            {/* [SEC] bug-audit hardening: Delete/Share/Open-with reach real
               document content — hide the trigger, not just the preview,
               until the lock gate above actually clears. */}
            {authorized === true && (
              <button
                type="button"
                className="kg-viewer__menu-btn"
                aria-label={t('actions.more')}
                data-agent-id="vault.viewer.more"
                onClick={() => setMenuOpen(true)}
              >
                <Icon name="MoreVertical" size={24} />
              </button>
            )}
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <main className="kg-viewer" data-agent-id="vault.viewer.content">
          {trashed && authorized === true && (
            <p className="kg-viewer__trashed-banner" data-agent-id="vault.viewer.trashed-banner">
              <Icon name="Trash2" size={16} aria-hidden />
              {t('viewer.trashed_banner')}
            </p>
          )}
          {loading || authorized !== true || fileLoading || (isDocxDoc && docxLoading) ? (
            <div className="kg-viewer__center" data-agent-state="loading">
              <IonSpinner name="crescent" />
            </div>
          ) : error || !document || (isDocxDoc && docxError) ? (
            <div className="kg-viewer__center" data-agent-id="vault.viewer.error">
              <Icon name="AlertCircle" size={32} aria-hidden />
              <p>{t('viewer.error')}</p>
            </div>
          ) : isDocxDoc ? (
            // F-43: rendered + sanitised Word document (see docx-viewer.ts).
            <section
              className="kg-viewer__docx"
              data-agent-id="vault.viewer.docx"
              // HTML is allow-list sanitised in convertDocxToHtml (docx-viewer.ts).
              dangerouslySetInnerHTML={{ __html: docxHtml ?? '' }}
            />
          ) : (
            <>
              <div
                className="kg-viewer__zoom"
                {...pageGestures.bind}
                data-agent-id="vault.viewer.zoom"
                data-agent-state={pageGestures.zoom > 1 ? 'expanded' : 'idle'}
              >
              <div
                className="kg-viewer__pages"
                data-agent-id="vault.viewer.pages"
                style={{ width: `${pageGestures.zoom * 100}%` }}
              >
                {pages.map((url, i) => (
                  // VW-3: each page is a framed sheet on the canvas, numbered.
                  <figure key={url} className="kg-viewer__sheet">
                    <img
                      className="kg-viewer__page"
                      src={url}
                      alt={t('viewer.page', { n: i + 1 })}
                    />
                    {pages.length > 1 && (
                      <figcaption className="kg-viewer__page-number">
                        {t('viewer.page_of', { n: i + 1, total: pages.length })}
                      </figcaption>
                    )}
                  </figure>
                ))}
              </div>
              </div>
              {pages.length > 0 && <p className="kg-viewer__zoom-hint">{t('viewer.zoom_hint')}</p>}

              <section className="kg-viewer__text" data-agent-id="vault.viewer.text-panel">
                {/* VW-6: Copy is an icon in the panel header, not a full-width button. */}
                <div className="kg-viewer__text-head">
                  <h2 className="kg-viewer__text-title">{t('viewer.extracted_text')}</h2>
                  {text && text.trim() && (
                    <Button
                      variant="ghost"
                      iconOnly
                      icon={<Icon name="Copy" size={20} />}
                      aria-label={t('viewer.copy')}
                      onClick={() => void handleCopy()}
                      agentId="vault.viewer.copy-text"
                    />
                  )}
                </div>
                {text && text.trim() ? (
                  <>
                    <p className="kg-viewer__text-body" data-agent-id="vault.viewer.text-body">
                      {text}
                    </p>
                    {detectedNumbers.length > 0 && (
                      <div
                        className="kg-viewer__numbers"
                        data-agent-id="vault.viewer.numbers-panel"
                      >
                        <h3 className="kg-viewer__numbers-title">
                          {t('viewer.detected_numbers')}
                        </h3>
                        <p className="kg-viewer__text-empty">{t('quick_reference.save_to_quickref')}</p>
                        <ul className="kg-viewer__numbers-list">
                          {detectedNumbers.map((n) => (
                            <li key={n}>
                              <NumberChip
                                value={n}
                                onCopy={(v) => void handleCopyNumber(v)}
                                onSaveToQuickReference={(v) => {
                                  const id = detectIdNumbers(v)[0];
                                  offerQuickReferenceDraft({
                                    label: id
                                      ? t(id.kind === 'pan' ? 'quick_reference.template_pan' : 'quick_reference.template_aadhaar')
                                      : '',
                                    value: id?.value ?? v,
                                    kind: id?.kind,
                                  });
                                  router.push('/quick-reference', 'forward', 'push');
                                }}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : canExtractText(document) ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={running && runningEngine === 'auto'}
                    onClick={() => void handleExtract()}
                    agentId="vault.viewer.extract-text"
                  >
                    {t('actions.extract_text')}
                  </Button>
                ) : (
                  // VW-2: don't say "works on images" while showing an image.
                  <p className="kg-viewer__text-empty">
                    {documentTypeIcon(document.fileType) === 'File'
                      ? t('viewer.no_text_type')
                      : t('viewer.no_text_device')}
                  </p>
                )}
                {/* Gemma transcription: offered even when text already exists (re-run replaces it). */}
                {canTranscribeWithVision(document) && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={running && runningEngine === 'vision'}
                      onClick={() => void handleExtract('vision')}
                      agentId="vault.viewer.transcribe-gemma"
                    >
                      {t('actions.transcribe_gemma')}
                    </Button>
                    <p className="kg-viewer__text-empty">{t('ocr.vision_hint')}</p>
                  </>
                )}
              </section>
            </>
          )}
        </main>

        <ActionSheet
          isOpen={menuOpen}
          header={document?.name}
          agentId="vault.viewer.menu"
          onDidDismiss={() => setMenuOpen(false)}
          buttons={[
            // F-64/F-65: hand the document to another app (native only).
            // Hidden for a trashed preview — Trash isn't the place to export
            // or hand off a document pending restore/delete-forever.
            ...(intents.supported && !trashed
              ? [
                  {
                    text: t('intents.open_with'),
                    icon: 'ExternalLink' as const,
                    handler: () => void handleOpenWith(),
                  },
                  {
                    text: t('intents.share'),
                    icon: 'Share2' as const,
                    handler: () => void handleShare(),
                  },
                ]
              : []),
            { text: t('details.title'), icon: 'Info', handler: () => setDetailsOpen(true) },
            // Rename/Delete hidden for a trashed preview — Trash already owns
            // restore/delete-forever, and renaming a trashed row before its
            // fate is decided isn't a supported flow. (Bug-audit fix: this
            // menu was previously missing Rename entirely — VaultHomePage's
            // item-menu already had it.)
            ...(trashed
              ? []
              : [
                  {
                    text: t('actions.rename'),
                    icon: 'Pencil' as const,
                    handler: () => setRenaming(true),
                  },
                  {
                    text: t('actions.delete'),
                    role: 'destructive' as const,
                    icon: 'Trash2' as const,
                    handler: handleDelete,
                  },
                ]),
            { text: t('actions.cancel'), role: 'cancel' },
          ]}
        />

        <DocumentDetailsSheet
          document={detailsOpen ? (document ?? null) : null}
          onClose={() => setDetailsOpen(false)}
        />

        {/* Mirrors VaultHomePage's item-menu rename Alert. */}
        <Alert
          isOpen={renaming}
          header={t('rename.title')}
          agentId="vault.viewer.rename-prompt"
          input={{
            label: t('rename.label'),
            defaultValue: document?.name ?? '',
          }}
          buttons={[
            { text: t('actions.cancel'), role: 'cancel' },
            {
              text: t('rename.save'),
              handler: (name?: string): void => {
                if (document && name) {
                  void rename(document, name);
                }
              },
            },
          ]}
          onDidDismiss={() => setRenaming(false)}
        />
        <IonToast
          isOpen={toast !== null}
          duration={2200}
          message={toast ?? ''}
          onDidDismiss={() => setToast(null)}
          data-agent-id="vault.viewer.toast"
        />
      </IonContent>
      {/* Smart UI §4: what people do next with an open document, in their
          path — same lock gate as the ⋮ menu; not for a Trash preview. */}
      {/* VW-1: when only "More" would be left, the header ⋮ already covers it. */}
      {document && authorized === true && !trashed && (intents.supported || ai.status !== 'unsupported' || typeTool) && (
        <IonFooter>
          <NextActions
            agentPrefix="vault.viewer.next"
            actions={[
              ...(intents.supported
                ? [{ id: 'share', icon: 'Share2' as const, label: t('preview.share'), onClick: () => void handleShare() }]
                : []),
              ...(ai.status !== 'unsupported'
                ? [{ id: 'ask-ai', icon: 'Assistant' as const, label: t('viewer.ask_ai'), onClick: () => router.push(askAiAboutRoute(document.id), 'forward', 'push') }]
                : []),
              // VW-8: the file type's most-needed tool, opened on this document.
              ...(typeTool
                ? [{ id: typeTool.id, icon: typeTool.icon, label: t(typeTool.labelKey), onClick: () => router.push(pdfToolRoute(typeTool.tool, document.id), 'forward', 'push') }]
                : []),
              { id: 'more', icon: 'MoreVertical', label: t('viewer.more'), onClick: () => setMenuOpen(true) },
            ]}
          />
        </IonFooter>
      )}
    </IonPage>
  );
}

export default DocumentViewerPage;
