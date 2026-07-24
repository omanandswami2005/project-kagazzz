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
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Button, Icon, Search } from '@kagaz/ui';
import { useDocuments } from '@/modules/document-vault/hooks/useDocuments';
import { usePdfEngine } from '../hooks/usePdfEngine';
import { PdfOpSheet } from '../components/PdfOpSheet';
import { PdfOrganizeSheet } from '../components/PdfOrganizeSheet';
import { PDF_OPS, searchPdfTools, type PdfOpCategory, type PdfOpId } from '@/core/pdf-tools-catalog';
import '../components/pdf-tools.css';

/** Filter chips shown above the grid, "All" first. */
const CATEGORIES: readonly PdfOpCategory[] = ['pdf', 'image', 'other'];

/** The PDF Tools landing page. */
export function PdfToolsPage(): ReactNode {
  const { t } = useTranslation('tools');
  const { documents } = useDocuments();
  const engine = usePdfEngine();
  const [activeOp, setActiveOp] = useState<PdfOpId | null>(null);
  // Native-only ops (e.g. the ML Kit scanner) are hidden on the web build.
  const isNative = Capacitor.isNativePlatform();
  const [savedCount, setSavedCount] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PdfOpCategory | null>(null);

  const ops = useMemo(() => {
    const platformOps = PDF_OPS.filter((op) => !op.native || isNative);
    const categoryOps = category
      ? platformOps.filter((op) => op.category === category)
      : platformOps;
    return query.trim() ? searchPdfTools(query, t, categoryOps) : categoryOps;
  }, [isNative, category, query, t]);

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

          <Search
            value={query}
            placeholder={t('search_placeholder')}
            aria-label={t('search_placeholder')}
            agentId="pdf-tools.search"
            onChange={setQuery}
          />

          <div
            className="kg-pdf-tools__categories"
            role="group"
            aria-label={t('category_filter_label')}
            data-agent-id="pdf-tools.categories"
            data-agent-state={category ?? 'all'}
          >
            <Button
              variant={category === null ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setCategory(null)}
              agentId="pdf-tools.category-all"
            >
              {t('category_all')}
            </Button>
            {CATEGORIES.map((c) => (
              <Button
                key={c}
                variant={category === c ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setCategory(c)}
                agentId={`pdf-tools.category-${c}`}
              >
                {t(`category_${c}`)}
              </Button>
            ))}
          </div>

          {ops.length === 0 ? (
            <p className="kg-pdf-tools__no-results" data-agent-id="pdf-tools.no-results">
              {t('no_results', { query })}
            </p>
          ) : (
            <ul className="kg-pdf-tools__grid" data-agent-id="pdf-tools.ops">
              {ops.map((op) => (
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
          )}
        </main>

        {/* F-35's organiser is its own thumbnail-grid modal; every other op
            runs through the adaptive PdfOpSheet. */}
        <PdfOpSheet
          op={activeOp === 'organize' ? null : activeOp}
          documents={documents}
          engine={engine}
          onClose={() => setActiveOp(null)}
          onDone={(count) => {
            setActiveOp(null);
            setSavedCount(count);
          }}
        />

        <PdfOrganizeSheet
          open={activeOp === 'organize'}
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
