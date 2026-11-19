/**
 * "Recent" tools row at the top of the PDF Tools hub (screen audit PT-5,
 * anticipatory design): the last few tools the user ran, each one tap to
 * reopen with the document it last ran on already chosen. Derived from the
 * same on-device tool history as the list at the bottom — nothing new stored.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@kagaz/ui';
import { PDF_OPS, type PdfOpId } from '@/core/pdf-tools-catalog';
import { useToolHistory, type ResolvedToolRun } from '../hooks/useToolHistory';

/** How many recent tools to offer. */
const RECENT_TOOLS = 3;

/** One recent tool and the document it last ran on (if it still exists). */
export interface RecentTool {
  op: PdfOpId;
  documentId?: string;
}

/** Latest distinct, successful tools first, each with its last live input. */
export function recentTools(entries: ResolvedToolRun[], limit = RECENT_TOOLS): RecentTool[] {
  const seen = new Set<string>();
  const out: RecentTool[] = [];
  for (const { run, inputs } of entries) {
    const op = PDF_OPS.find((o) => o.id === run.toolId)?.id;
    if (!op || run.status !== 'completed' || seen.has(op)) continue;
    seen.add(op);
    out.push({ op, documentId: inputs.find((i) => i.doc !== null)?.id });
    if (out.length === limit) break;
  }
  return out;
}

/** Props for {@link RecentTools}. */
export interface RecentToolsProps {
  /** Change to reload after a run. */
  refreshKey?: unknown;
  /** Reopens a tool, optionally with its last document pre-selected. */
  onPick: (op: PdfOpId, documentId?: string) => void;
}

/** Up to three "run it again" shortcuts; renders nothing before the first run. */
export function RecentTools({ refreshKey, onPick }: RecentToolsProps): ReactNode {
  const { t } = useTranslation('tools');
  const { entries } = useToolHistory(undefined, refreshKey);
  const recent = recentTools(entries);
  if (recent.length === 0) return null;
  return (
    <section className="kg-pdf-recent" aria-labelledby="pdf-recent-title" data-agent-id="pdf-tools.recent">
      <h2 className="kg-pdf-recent__title" id="pdf-recent-title">
        {t('recent_tools')}
      </h2>
      <div className="kg-pdf-recent__row">
        {recent.map(({ op, documentId }) => {
          const meta = PDF_OPS.find((o) => o.id === op);
          return (
            <button
              key={op}
              type="button"
              className="kg-pdf-recent__btn"
              onClick={() => onPick(op, documentId)}
              data-agent-id={`pdf-tools.recent-${op}`}
            >
              <Icon name={meta?.icon ?? 'FileText'} size={20} />
              <span>{t(`ops.${op}`)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
