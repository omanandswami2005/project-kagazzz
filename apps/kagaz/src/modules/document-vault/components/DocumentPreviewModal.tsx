/**
 * In-place document preview (smart UI plan §5): look at a document without
 * leaving the current screen — the AI chat's document links and result cards
 * open it. Shows the page preview, name and size, with Open (full viewer),
 * Share and Close. Closing returns to exactly where the user was.
 *
 * [SEC] callers pass unlocked documents only; a locked one is blurred by
 * DocumentThumb, and Open goes through the viewer's biometric gate anyway.
 */
import { IonContent, IonFooter, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@kagaz/ui';
import { DocumentThumb } from '@/core/components/DocumentThumb';
import { formatFileSize } from '@/core/i18n';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useDocumentIntents } from '../hooks/useDocumentIntents';
import './document-preview.css';

/** Props for {@link DocumentPreviewModal}. */
export interface DocumentPreviewModalProps {
  /** The document to preview; null = closed. */
  document: DocumentEntity | null;
  /** Open the full viewer. */
  onOpen: (document: DocumentEntity) => void;
  onClose: () => void;
}

/** A sheet previewing one document with Open / Share / Close. */
export function DocumentPreviewModal({ document, onOpen, onClose }: DocumentPreviewModalProps): ReactNode {
  const { t, i18n } = useTranslation('documents');
  const intents = useDocumentIntents();
  return (
    <IonModal
      isOpen={document !== null}
      onDidDismiss={onClose}
      initialBreakpoint={0.85}
      breakpoints={[0, 0.85, 1]}
      data-agent-id="doc-preview"
      data-agent-state={document ? 'open' : 'closed'}
    >
      {document && (
        <>
          <IonHeader>
            <IonToolbar>
              <IonTitle>{document.name}</IonTitle>
            </IonToolbar>
          </IonHeader>
          <IonContent>
            <div className="kg-doc-preview">
              <DocumentThumb document={document} iconSize={48} className="kg-doc-preview__thumb" />
              <p className="kg-doc-preview__meta">
                {document.fileType.toUpperCase()} · {formatFileSize(document.fileSize, i18n.language)}
              </p>
            </div>
          </IonContent>
          <IonFooter>
            <div className="kg-doc-preview__actions">
              <Button variant="primary" onClick={() => onOpen(document)} agentId="doc-preview.open">
                <Icon name="Eye" size={20} aria-hidden />
                {t('preview.open')}
              </Button>
              {intents.supported && (
                <Button variant="secondary" onClick={() => void intents.share(document)} agentId="doc-preview.share">
                  <Icon name="Share2" size={20} aria-hidden />
                  {t('preview.share')}
                </Button>
              )}
              <Button variant="ghost" onClick={onClose} agentId="doc-preview.close">
                {t('preview.close')}
              </Button>
            </div>
          </IonFooter>
        </>
      )}
    </IonModal>
  );
}
