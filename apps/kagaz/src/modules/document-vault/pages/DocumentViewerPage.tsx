/**
 * Document viewer (UX-6) — the preview that F-24 deferred. Renders images and
 * PDF pages (via the pdf-engine's pdfjs path), and surfaces the **extracted
 * text** (OCR, F-20) so users can finally read/copy what OCR produced.
 *
 * [SEC] A per-document-locked file (§3.1) is authorized before it renders; a
 * declined prompt sends the user back. Extracted text is shown from the
 * encrypted DB and copied only on explicit user action.
 */
import {
  IonActionSheet,
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonSpinner,
  IonTitle,
  IonToast,
  IonToolbar,
  useIonRouter,
} from '@ionic/react';
import { useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@kagaz/ui';
import { useDocument } from '../hooks/useDocument';
import { useDocumentFile } from '../hooks/useDocumentFile';
import { useDocxHtml } from '../hooks/useDocxHtml';
import { canExtractText, useDocumentOcr } from '../hooks/useDocumentOcr';
import { useVaultMutations } from '../hooks/useVaultMutations';
import './viewer.css';

/** Full-screen viewer for one document. */
export function DocumentViewerPage(): ReactNode {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation('documents');
  const router = useIonRouter();
  const { document, loading } = useDocument(id);
  const { pages, loading: fileLoading, error } = useDocumentFile(document);
  const { html: docxHtml, loading: docxLoading, error: docxError } = useDocxHtml(document);
  const isDocxDoc = document?.fileType.toLowerCase() === 'docx';
  const { extractText, runningId } = useDocumentOcr();
  const { softDelete } = useVaultMutations();

  // Extracted text: the freshly-extracted override, else the stored OCR text.
  // Derived (no effect) so it stays in sync as the document loads.
  // [SEC] the per-doc lock is enforced at the entry point
  // (VaultHomePage/FavoritesPage authorize before navigating — the only routes
  // into the viewer).
  const [extracted, setExtracted] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const text = extracted ?? document?.ocrText ?? null;

  const running = document != null && runningId === document.id;

  const handleExtract = async (): Promise<void> => {
    if (!document) {
      return;
    }
    const out = await extractText(document);
    setExtracted(out);
    setToast(out === null ? t('ocr.failed') : out.trim() ? t('ocr.done') : t('ocr.none'));
  };

  const handleCopy = async (): Promise<void> => {
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        setToast(t('viewer.copied'));
      } catch {
        setToast(t('ocr.failed'));
      }
    }
  };

  const handleDelete = (): void => {
    if (document) {
      void softDelete(document);
      router.goBack();
    }
  };

  return (
    <IonPage data-agent-id="vault.viewer">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/vault" data-agent-id="vault.viewer.back" />
          </IonButtons>
          <IonTitle>{document?.name ?? ''}</IonTitle>
          <IonButtons slot="end">
            <button
              type="button"
              className="kg-viewer__menu-btn"
              aria-label={t('actions.more')}
              data-agent-id="vault.viewer.more"
              onClick={() => setMenuOpen(true)}
            >
              <Icon name="MoreVertical" size={24} />
            </button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <main className="kg-viewer" data-agent-id="vault.viewer.content">
          {loading || fileLoading || (isDocxDoc && docxLoading) ? (
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
              <div className="kg-viewer__pages" data-agent-id="vault.viewer.pages">
                {pages.map((url, i) => (
                  <img
                    key={url}
                    className="kg-viewer__page"
                    src={url}
                    alt={t('viewer.page', { n: i + 1 })}
                  />
                ))}
              </div>

              <section className="kg-viewer__text" data-agent-id="vault.viewer.text-panel">
                <h2 className="kg-viewer__text-title">{t('viewer.extracted_text')}</h2>
                {text && text.trim() ? (
                  <>
                    <p className="kg-viewer__text-body">{text}</p>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void handleCopy()}
                      agentId="vault.viewer.copy-text"
                    >
                      {t('viewer.copy')}
                    </Button>
                  </>
                ) : canExtractText(document) ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={running}
                    onClick={() => void handleExtract()}
                    agentId="vault.viewer.extract-text"
                  >
                    {t('actions.extract_text')}
                  </Button>
                ) : (
                  <p className="kg-viewer__text-empty">{t('viewer.no_text')}</p>
                )}
              </section>
            </>
          )}
        </main>

        <IonActionSheet
          isOpen={menuOpen}
          header={document?.name}
          data-agent-id="vault.viewer.menu"
          onDidDismiss={() => setMenuOpen(false)}
          buttons={[
            {
              text: t('actions.delete'),
              role: 'destructive',
              handler: handleDelete,
            },
            { text: t('actions.cancel'), role: 'cancel' },
          ]}
        />
        <IonToast
          isOpen={toast !== null}
          duration={2200}
          message={toast ?? ''}
          onDidDismiss={() => setToast(null)}
          data-agent-id="vault.viewer.toast"
        />
      </IonContent>
    </IonPage>
  );
}

export default DocumentViewerPage;
