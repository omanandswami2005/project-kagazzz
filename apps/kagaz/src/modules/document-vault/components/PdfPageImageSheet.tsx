/**
 * Save page as image (F-86, 02-document-vault-module.md §Save Page as Image).
 * A quick, single-document entry point into the existing F-6 pdfToImages
 * renderer: pick 1-3 (or more) pages by number, save each as a full-page
 * raster image — the same whole-page rasterisation the Tools-hub "PDF to
 * images" op uses. Deliberately NOT a "pull the embedded picture out of the
 * PDF" feature: a scanned page can carry a stamped page-number/watermark on
 * top (added via Stamp/Page Numbers), and only rendering the complete,
 * composited page guarantees the saved image matches what the page actually
 * shows — the same reasoning behind useDocumentOcr's per-page OCR fix.
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
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Input } from '@kagaz/ui';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { usePdfEngine } from '@/modules/pdf-engine/hooks/usePdfEngine';
import { flattenPageRanges, parsePageRanges } from '@/modules/pdf-engine/services/parse-ranges';
import './pdf-page-image-sheet.css';

/** Props for {@link PdfPageImageSheet}. */
export interface PdfPageImageSheetProps {
  /** The PDF to render pages from, or null when the sheet is closed. */
  document: DocumentEntity | null;
  onClose: () => void;
  /** Called once a run finishes (success or failure) so the caller can toast. */
  onDone?: (saved: number) => void;
}

/** Quick page → image extraction sheet, reached directly from the item-menu. */
export function PdfPageImageSheet({
  document,
  onClose,
  onDone,
}: PdfPageImageSheetProps): ReactNode {
  const { t } = useTranslation('documents');
  const { state, pdfToImages } = usePdfEngine();
  const [pages, setPages] = useState('1');
  const [saved, setSaved] = useState<number | null>(null);

  // Reset each time a new document opens into the sheet (same trade-off
  // ResizeCompressSheet/PdfOpSheet make: skips the close animation vs a
  // `key` remount, but keeps the form predictable per document).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setPages('1');
    setSaved(null);
  }, [document?.id]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const ranges = parsePageRanges(pages);
  const pageIndices = ranges ? flattenPageRanges(ranges) : [];
  const canRun = ranges !== null && pageIndices.length > 0;
  const busy = state.busy;

  const handleRun = (): void => {
    if (!document || !canRun) {
      return;
    }
    setSaved(null);
    void pdfToImages(document, { format: 'jpeg', scale: 2, pages: pageIndices }).then(
      (count) => {
        setSaved(count);
        onDone?.(count);
      }
    );
  };

  return (
    <IonModal
      isOpen={document !== null}
      onDidDismiss={onClose}
      data-agent-id="vault.home.page-image-sheet"
      data-agent-state={document ? 'open' : 'closed'}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('page_image.title')}</IonTitle>
          <IonButtons slot="end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              agentId="vault.home.page-image-sheet.close"
            >
              <Icon name="X" size={24} aria-label="Close" />
            </Button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="kg-page-image">
          <p className="kg-page-image__hint">{t('page_image.hint')}</p>
          <Input
            type="text"
            label={t('page_image.pages')}
            placeholder={t('page_image.pages_placeholder')}
            value={pages}
            onChange={setPages}
            agentId="vault.home.page-image-pages"
          />
          {pages.trim().length > 0 && !canRun && (
            <p
              className="kg-page-image__error"
              role="alert"
              data-agent-id="vault.home.page-image-error"
            >
              {t('page_image.invalid_pages')}
            </p>
          )}
          {!busy && saved === null && ranges && pageIndices.length > 0 && (
            <p className="kg-page-image__count" data-agent-id="vault.home.page-image-count">
              {t('page_image.page_count', { count: pageIndices.length })}
            </p>
          )}
          {!busy && saved !== null && (
            <p
              className="kg-page-image__count"
              role="status"
              data-agent-id="vault.home.page-image-result"
              data-agent-state={saved > 0 ? 'success' : 'error'}
            >
              {saved > 0 ? t('page_image.done', { count: saved }) : t('page_image.failed')}
            </p>
          )}
        </div>
      </IonContent>

      <IonFooter>
        <div className="kg-page-image__footer">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={busy || !canRun}
            onClick={handleRun}
            agentId="vault.home.page-image-run"
            agentAction="vault.savePageAsImage"
          >
            {busy ? t('page_image.running') : t('page_image.run')}
          </Button>
        </div>
      </IonFooter>
    </IonModal>
  );
}
