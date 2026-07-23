/**
 * Extract pages (F-66 UX follow-up, 02-document-vault-module.md
 * §Item-menu-first PDF tools). A quick, single-document entry point into the
 * existing F-66 extractPages engine call — pick pages by number, save them
 * as a new PDF — promoted from the Tools hub's tool-first flow straight onto
 * the document it applies to, same reasoning and shape as F-86's
 * PdfPageImageSheet (which this deliberately mirrors rather than shares a
 * component with: the two differ in output type — new PDF vs. images — and
 * in the page-range shape the underlying engine call wants).
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
import { pdfErrorMessageKey } from '@/modules/pdf-engine/services/pdf-error-message';
import './pdf-page-image-sheet.css';

/** Props for {@link PdfExtractPagesSheet}. */
export interface PdfExtractPagesSheetProps {
  /** The PDF to extract pages from, or null when the sheet is closed. */
  document: DocumentEntity | null;
  onClose: () => void;
  /** Called once a run finishes (success or failure) so the caller can toast. */
  onDone?: (saved: number) => void;
}

/** Quick page-extraction-to-new-PDF sheet, reached directly from the item-menu. */
export function PdfExtractPagesSheet({
  document,
  onClose,
  onDone,
}: PdfExtractPagesSheetProps): ReactNode {
  const { t } = useTranslation('documents');
  const { t: tTools } = useTranslation('tools');
  const { state, extractPages } = usePdfEngine();
  const [pages, setPages] = useState('1');
  const [saved, setSaved] = useState<number | null>(null);

  // Reset each time a new document opens into the sheet (same trade-off
  // PdfPageImageSheet/ResizeCompressSheet/PdfOpSheet make: skips the close
  // animation vs a `key` remount, but keeps the form predictable per document).
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
  // Bug-audit fix: this used to always show the generic "failed" text on
  // saved === 0 — an out-of-range/invalid-PDF/etc. failure was
  // indistinguishable from any other. Same specific-message-over-generic
  // pattern PdfOpSheet already uses.
  const engineErrorKey = pdfErrorMessageKey(state.errorCode);

  const handleRun = (): void => {
    if (!document || !ranges || !canRun) {
      return;
    }
    setSaved(null);
    void extractPages(document, ranges).then((count) => {
      setSaved(count);
      onDone?.(count);
    });
  };

  return (
    <IonModal
      isOpen={document !== null}
      onDidDismiss={onClose}
      data-agent-id="vault.home.extract-pages-sheet"
      data-agent-state={document ? 'open' : 'closed'}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('pdf_extract_pages.title')}</IonTitle>
          <IonButtons slot="end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              agentId="vault.home.extract-pages-sheet.close"
            >
              <Icon name="X" size={24} aria-label="Close" />
            </Button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="kg-page-image">
          <p className="kg-page-image__hint">{t('pdf_extract_pages.hint')}</p>
          <Input
            type="text"
            label={t('page_image.pages')}
            placeholder={t('page_image.pages_placeholder')}
            value={pages}
            onChange={setPages}
            agentId="vault.home.extract-pages-pages"
          />
          {pages.trim().length > 0 && !canRun && (
            <p
              className="kg-page-image__error"
              role="alert"
              data-agent-id="vault.home.extract-pages-error"
            >
              {t('page_image.invalid_pages')}
            </p>
          )}
          {!busy && saved === null && ranges && pageIndices.length > 0 && (
            <p className="kg-page-image__count" data-agent-id="vault.home.extract-pages-count">
              {t('page_image.page_count', { count: pageIndices.length })}
            </p>
          )}
          {!busy && saved !== null && (
            <p
              className="kg-page-image__count"
              role="status"
              data-agent-id="vault.home.extract-pages-result"
              data-agent-state={saved > 0 ? 'success' : 'error'}
            >
              {saved > 0
                ? t('pdf_extract_pages.done')
                : engineErrorKey
                  ? tTools(engineErrorKey)
                  : t('pdf_extract_pages.failed')}
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
            agentId="vault.home.extract-pages-run"
            agentAction="vault.extractPages"
          >
            {busy ? t('pdf_extract_pages.running') : t('pdf_extract_pages.run')}
          </Button>
        </div>
      </IonFooter>
    </IonModal>
  );
}
