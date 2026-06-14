/**
 * PDF Tools hub (F-3..F-7, F-21, F-22, F-28). A grid of PDF operations; each
 * opens an {@link PdfOpSheet} that picks vault document(s), runs the engine,
 * and saves the result back to the vault. Reached from the vault.
 */
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@kagaz/ui';
import { useDocuments } from '@/modules/document-vault/hooks/useDocuments';
import { usePdfEngine } from '../hooks/usePdfEngine';
import { PdfOpSheet } from '../components/PdfOpSheet';
import { PDF_OPS, type PdfOpId } from '../services/pdf-ops-meta';
import '../components/pdf-tools.css';

/** The PDF Tools landing page. */
export function PdfToolsPage(): ReactNode {
  const { t } = useTranslation('tools');
  const { documents } = useDocuments();
  const engine = usePdfEngine();
  const [activeOp, setActiveOp] = useState<PdfOpId | null>(null);
  const [savedCount, setSavedCount] = useState(0);

  return (
    <IonPage data-agent-id="pdf-tools">
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/vault" data-agent-id="pdf-tools.back" />
          </IonButtons>
          <IonTitle>{t('title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <main className="kg-pdf-tools" data-agent-id="pdf-tools.content">
          <p className="kg-pdf-tools__subtitle">{t('subtitle')}</p>
          <ul className="kg-pdf-tools__grid" data-agent-id="pdf-tools.ops">
            {PDF_OPS.map((op) => (
              <li key={op.id}>
                <button
                  type="button"
                  className="kg-pdf-tools__card"
                  onClick={() => setActiveOp(op.id)}
                  data-agent-id={`pdf-tools.op-${op.id}`}
                >
                  <Icon name={op.icon} size={32} aria-hidden />
                  <span className="kg-pdf-tools__card-title">{t(`ops.${op.id}`)}</span>
                  <span className="kg-pdf-tools__card-desc">{t(`desc.${op.id}`)}</span>
                </button>
              </li>
            ))}
          </ul>
        </main>

        <PdfOpSheet
          op={activeOp}
          documents={documents}
          engine={engine}
          onClose={() => setActiveOp(null)}
          onDone={(count) => {
            setActiveOp(null);
            setSavedCount(count);
          }}
        />

        <IonToast
          isOpen={savedCount > 0}
          duration={2500}
          message={t(savedCount === 1 ? 'saved_one' : 'saved_other', {
            count: savedCount,
          })}
          onDidDismiss={() => setSavedCount(0)}
          data-agent-id="pdf-tools.saved-toast"
        />
      </IonContent>
    </IonPage>
  );
}

export default PdfToolsPage;
