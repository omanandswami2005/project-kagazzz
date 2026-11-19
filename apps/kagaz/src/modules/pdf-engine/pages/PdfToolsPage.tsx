/**
 * PDF Tools hub (F-3..F-7, F-21, F-22, F-28). A grid of PDF operations; each
 * opens an {@link PdfOpSheet} that picks vault document(s), runs the engine,
 * and saves the result back to the vault. Reached from the vault.
 */
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { DOC_PARAM, TOOL_PARAM } from '@/core/constants/routes';
import { useTranslation } from 'react-i18next';
import { Capacitor } from '@capacitor/core';
import { Icon, Search, SegmentedControl } from '@kagaz/ui';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useDocuments } from '@/modules/document-vault/hooks/useDocuments';
import { usePdfEngine } from '../hooks/usePdfEngine';
import { PdfOpSheet } from '../components/PdfOpSheet';
import { PdfOrganizeSheet } from '../components/PdfOrganizeSheet';
import { RecentTools } from '../components/RecentTools';
import { ToolHistoryList } from '../components/ToolHistoryList';
import { ToolResultSheet } from '../components/ToolResultSheet';
import { PDF_OPS, searchPdfTools, type PdfOpCategory, type PdfOpId } from '@/core/pdf-tools-catalog';
import '../components/pdf-tools.css';
import { MenuButton } from '@/app/shell/MenuButton';
import { TOOLS_TOUR, TOOLS_TOUR_TIP } from '@/app/onboarding/tour';
import { useFirstRunTour } from '@/app/onboarding/useFirstRunTour';

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
  const router = useIonRouter();
  // Documents the last run created → the result sheet (replaces the toast).
  const [result, setResult] = useState<DocumentEntity[]>([]);
  // Bumped after every run so the history lists reload.
  const [runs, setRuns] = useState(0);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<PdfOpCategory | null>(null);

  // Hand-off from a document (viewer next actions, VW-8): `?tool=&doc=` opens
  // that tool with the document already chosen (TS-9), then clears the query
  // so Back doesn't reopen it.
  const location = useLocation();
  const history = useHistory();
  const params = new URLSearchParams(location.search);
  const linkedTool = PDF_OPS.find((o) => o.id === params.get(TOOL_PARAM))?.id ?? null;
  const linkedDoc = params.get(DOC_PARAM) ?? undefined;
  const [preselectId, setPreselectId] = useState<string | undefined>(undefined);
  const [handledLink, setHandledLink] = useState<string | null>(null);
  if (linkedTool && handledLink !== location.search) {
    setHandledLink(location.search);
    setPreselectId(linkedDoc);
    setActiveOp(linkedTool);
  } else if (!linkedTool && handledLink) {
    // The page stays cached: forget the handled link once the URL is clean,
    // so the same link opens the tool again next time.
    setHandledLink(null);
  }
  useEffect(() => {
    if (handledLink && handledLink === location.search) {
      history.replace(location.pathname);
    }
  }, [handledLink, location.search, location.pathname, history]);

  const ops = useMemo(() => {
    const platformOps = PDF_OPS.filter((op) => !op.native || isNative);
    const categoryOps = category
      ? platformOps.filter((op) => op.category === category)
      : platformOps;
    return query.trim() ? searchPdfTools(query, t, categoryOps) : categoryOps;
  }, [isNative, category, query, t]);

  const openDocument = useCallback(
    (doc: DocumentEntity): void => {
      setActiveOp(null);
      setResult([]);
      router.push(`/doc/${doc.id}`);
    },
    [router]
  );

  const handleDone = (): void => {
    setActiveOp(null);
    setResult(engine.lastCreated());
    setRuns((n) => n + 1);
  };

  // First-run journey: the first visit gets a three-step tour — but never
  // over a tool a deep link already opened.
  useFirstRunTour(TOOLS_TOUR, TOOLS_TOUR_TIP, activeOp === null && result.length === 0 && !query);

  return (
    <IonPage data-agent-id="pdf-tools">
      <IonHeader>
        <IonToolbar>
          <MenuButton />
          <IonTitle>{t('title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <main className="kg-pdf-tools" data-agent-id="pdf-tools.content">
          <p className="kg-pdf-tools__subtitle">{t('subtitle')}</p>

          {/* PT-5: what you ran last, first — the full history stays below. */}
          {!query.trim() && (
            <RecentTools
              refreshKey={runs}
              onPick={(op, documentId) => {
                setPreselectId(documentId);
                setActiveOp(op);
              }}
            />
          )}

          <Search
            value={query}
            placeholder={t('search_placeholder')}
            aria-label={t('search_placeholder')}
            agentId="pdf-tools.search"
            onChange={setQuery}
          />

          <SegmentedControl
            aria-label={t('category_filter_label')}
            agentId="pdf-tools.categories"
            optionAgentId={(c) => `pdf-tools.category-${c}`}
            value={category ?? 'all'}
            onChange={(c) => setCategory(c === 'all' ? null : c)}
            options={(['all', ...CATEGORIES] as const).map((c) => ({
              value: c,
              label: t(`category_${c}`),
            }))}
            fullWidth
          />

          {ops.length === 0 ? (
            <p className="kg-pdf-tools__no-results" data-agent-id="pdf-tools.no-results">
              {t('no_results', { query })}
            </p>
          ) : (
            // PT-6: "All" shows the tools grouped under headings, not one wall.
            <div data-agent-id="pdf-tools.ops">
              {(category === null && !query.trim()
                ? CATEGORIES.map((c) => ({ c, list: ops.filter((op) => op.category === c) }))
                : [{ c: null, list: ops }]
              )
                .filter((group) => group.list.length > 0)
                .map((group) => (
                  <section key={group.c ?? 'all'} className="kg-pdf-tools__group">
                    {group.c && <h2 className="kg-pdf-tools__group-title">{t(`category_${group.c}`)}</h2>}
                    <ul className="kg-pdf-tools__grid">
                      {group.list.map((op) => (
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
                  </section>
                ))}
            </div>
          )}

          <ToolHistoryList refreshKey={runs} onOpen={openDocument} clearable />
        </main>

        {/* F-35's organiser is its own thumbnail-grid modal; every other op
            runs through the adaptive PdfOpSheet. */}
        <PdfOpSheet
          op={activeOp === 'organize' ? null : activeOp}
          documents={documents}
          engine={engine}
          onClose={() => {
            setActiveOp(null);
            setPreselectId(undefined);
          }}
          onDone={handleDone}
          onOpenDocument={openDocument}
          historyKey={runs}
          preselectId={preselectId}
        />

        <PdfOrganizeSheet
          open={activeOp === 'organize'}
          documents={documents}
          engine={engine}
          onClose={() => setActiveOp(null)}
          onDone={handleDone}
        />

        <ToolResultSheet documents={result} onOpen={openDocument} onClose={() => setResult([])} />
      </IonContent>
    </IonPage>
  );
}

export default PdfToolsPage;
