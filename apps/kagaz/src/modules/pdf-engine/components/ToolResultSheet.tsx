/**
 * What an operation made (2026-11-19, user feedback: "after an operation it
 * just shows created — no button to see it"). Opens as soon as a run saves:
 * every new document as a preview tile with Open and Share, then Done.
 */
import { IonContent, IonFooter, IonHeader, IonModal, IonTitle, IonToolbar } from '@ionic/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@kagaz/ui';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { DocumentThumb } from '@/core/components/DocumentThumb';
import { useDocumentIntents } from '@/modules/document-vault/hooks/useDocumentIntents';

/** Props for {@link ToolResultSheet}. */
export interface ToolResultSheetProps {
  /** The created documents; empty = closed. */
  documents: DocumentEntity[];
  onOpen: (document: DocumentEntity) => void;
  onClose: () => void;
}

/** Result sheet with Open / Share for each created document. */
export function ToolResultSheet({ documents, onOpen, onClose }: ToolResultSheetProps): ReactNode {
  const { t } = useTranslation('tools');
  const intents = useDocumentIntents();
  const open = documents.length > 0;

  return (
    <IonModal
      isOpen={open}
      onDidDismiss={onClose}
      data-agent-id="pdf-tools.result"
      data-agent-state={open ? 'open' : 'closed'}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            {t(documents.length === 1 ? 'saved_one' : 'saved_other', { count: documents.length })}
          </IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <ul className="kg-tool-result">
          {documents.map((doc) => (
            <li key={doc.id} className="kg-tool-result__item" data-agent-id={`pdf-tools.result.doc-${doc.id}`}>
              <button
                type="button"
                className="kg-tool-result__preview"
                onClick={() => onOpen(doc)}
                aria-label={t('result.open_named', { name: doc.name })}
                data-agent-id={`pdf-tools.result.preview-${doc.id}`}
              >
                <DocumentThumb document={doc} iconSize={48} />
              </button>
              <div className="kg-tool-result__body">
                <span className="kg-tool-result__name">{doc.name}</span>
                <div className="kg-tool-result__actions">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => onOpen(doc)}
                    agentId={`pdf-tools.result.open-${doc.id}`}
                  >
                    <Icon name="Eye" size={16} aria-hidden />
                    {t('result.open')}
                  </Button>
                  {intents.supported && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void intents.share(doc)}
                      agentId={`pdf-tools.result.share-${doc.id}`}
                    >
                      <Icon name="Share2" size={16} aria-hidden />
                      {t('result.share')}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </IonContent>
      <IonFooter>
        <div className="kg-pdf-op__footer">
          <Button variant="secondary" size="lg" fullWidth onClick={onClose} agentId="pdf-tools.result.done">
            {t('result.done')}
          </Button>
        </div>
      </IonFooter>
    </IonModal>
  );
}
