/**
 * F-35 page organiser: pick a PDF, then reorder / rotate / delete its pages on
 * a thumbnail grid and save the result to the vault. Thumbnails come from the
 * engine's page renderer (pdfjs + canvas, device only); the reorder/rotate/
 * delete logic lives in pure helpers (organize-page-ops) so it is unit-tested.
 */
import {
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, ProgressBar } from '@kagaz/ui';
import type { DocumentEntity } from '@/infrastructure/database/types';
import type { UsePdfEngineResult } from '../hooks/usePdfEngine';
import {
  movePage,
  removePage,
  rotatePage,
  toPageOps,
  type OrganizePage,
} from '../services/organize-page-ops';
import { PdfDocPicker } from './PdfDocPicker';

/** Props for {@link PdfOrganizeSheet}. */
export interface PdfOrganizeSheetProps {
  /** True when the organiser is open. */
  open: boolean;
  documents: DocumentEntity[];
  engine: UsePdfEngineResult;
  onClose: () => void;
  onDone: (savedCount: number) => void;
}

/** A working page plus its object-URL thumbnail. */
interface PreviewPage extends OrganizePage {
  url: string;
}

/** Full-screen page organiser modal. */
export function PdfOrganizeSheet({
  open,
  documents,
  engine,
  onClose,
  onDone,
}: PdfOrganizeSheetProps): ReactNode {
  const { t } = useTranslation('tools');
  const pdfs = useMemo(
    () => documents.filter((d) => d.fileType.toLowerCase() === 'pdf'),
    [documents]
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pages, setPages] = useState<PreviewPage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedDoc = pdfs.find((d) => d.id === selectedId) ?? null;
  // Thumbnails are still loading once a PDF is picked but no pages/error yet.
  const loading = !!selectedDoc && pages === null && error === null;

  // Load thumbnails for the chosen PDF. State is only set inside async callbacks
  // (never synchronously in the effect body), so there is no extra render pass.
  useEffect(() => {
    if (!open || !selectedDoc || pages !== null) {
      return undefined;
    }
    let cancelled = false;
    let urls: string[] = [];
    engine
      .loadPagePreviews(selectedDoc)
      .then((blobs) => {
        if (cancelled) {
          return;
        }
        urls = blobs.map((b) => URL.createObjectURL(b));
        setPages(
          urls.map((url, i) => ({ key: `p${i}`, sourceIndex: i, rotation: 0, url }))
        );
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('errors.failed'));
        }
      });
    return (): void => {
      cancelled = true;
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedId]);

  // Resetting on dismiss (an event, not an effect) keeps reopening fresh.
  const handleDismiss = (): void => {
    setSelectedId(null);
    setPages(null);
    setError(null);
    engine.reset();
    onClose();
  };

  const busy = engine.state.busy;

  const handleSave = (): void => {
    if (!selectedDoc || !pages || pages.length === 0) {
      return;
    }
    void engine.organizePages(selectedDoc, toPageOps(pages)).then((count) => {
      if (count > 0) {
        onDone(count);
      }
    });
  };

  return (
    <IonModal
      isOpen={open}
      onDidDismiss={handleDismiss}
      data-agent-id="pdf-tools.organize-sheet"
      data-agent-state={open ? 'open' : 'closed'}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('ops.organize')}</IonTitle>
          <IonButtons slot="end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDismiss}
              agentId="pdf-tools.organize-sheet.close"
            >
              <Icon name="X" size={24} aria-label="Close" />
            </Button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="kg-pdf-op">
          {!selectedDoc && (
            <PdfDocPicker
              documents={pdfs}
              multi={false}
              selectedIds={[]}
              onChange={(ids) => setSelectedId(ids[0] ?? null)}
              emptyText={t('pick.empty_pdf')}
              idPrefix="pdf-tools.organize-picker"
            />
          )}

          {selectedDoc && loading && (
            <p className="kg-pdf-op__status">{t('organize.loading')}</p>
          )}

          {selectedDoc && pages && pages.length > 0 && (
            <ul className="kg-pdf-organize" data-agent-id="pdf-tools.organize.pages">
              {pages.map((page, index) => (
                <li key={page.key} className="kg-pdf-organize__page">
                  <div className="kg-pdf-organize__thumb">
                    <img
                      src={page.url}
                      alt={t('organize.page_alt', { n: index + 1 })}
                      style={{ transform: `rotate(${page.rotation}deg)` }}
                    />
                    <span className="kg-pdf-organize__num">{index + 1}</span>
                  </div>
                  <div className="kg-pdf-organize__controls">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === 0}
                      onClick={() => setPages((p) => (p ? movePage(p, page.key, -1) : p))}
                      agentId={`pdf-tools.organize.move-up-${page.key}`}
                    >
                      <Icon name="ChevronLeft" size={20} aria-label={t('organize.move_left')} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPages((p) => (p ? rotatePage(p, page.key) : p))}
                      agentId={`pdf-tools.organize.rotate-${page.key}`}
                    >
                      <Icon name="RotateCw" size={20} aria-label={t('organize.rotate')} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pages.length <= 1}
                      onClick={() => setPages((p) => (p ? removePage(p, page.key) : p))}
                      agentId={`pdf-tools.organize.delete-${page.key}`}
                    >
                      <Icon name="Trash2" size={20} aria-label={t('organize.delete')} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={index === pages.length - 1}
                      onClick={() => setPages((p) => (p ? movePage(p, page.key, 1) : p))}
                      agentId={`pdf-tools.organize.move-down-${page.key}`}
                    >
                      <Icon name="ChevronRight" size={20} aria-label={t('organize.move_right')} />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {error && (
            <p className="kg-pdf-op__error" role="alert" data-agent-state="error">
              {error}
            </p>
          )}

          {busy && (
            <div className="kg-pdf-op__progress" data-agent-state="loading">
              <ProgressBar
                value={engine.state.percent}
                aria-label={t('running')}
                showLabel
                indeterminate={engine.state.saving}
              />
              <p className="kg-pdf-op__status">
                {engine.state.saving ? t('finalizing') : t('running')}
              </p>
            </div>
          )}
        </div>
      </IonContent>

      <IonFooter>
        <div className="kg-pdf-op__footer">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={busy || !pages || pages.length === 0}
            onClick={handleSave}
            agentId="pdf-tools.organize-sheet.save"
          >
            {busy ? t('running') : t('organize.save')}
          </Button>
        </div>
      </IonFooter>
    </IonModal>
  );
}
