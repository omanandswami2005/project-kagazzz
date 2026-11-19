/**
 * PDF Tools history list (2026-11-19): one tool's runs inside its sheet, or
 * every tool's runs on the PDF Tools page. Each row shows the tool (combined
 * view only), when it ran, what went in, and the documents it created as
 * tappable tiles that open the document. Deleted documents show as such.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@kagaz/ui';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { DocumentThumb } from '@/core/components/DocumentThumb';
import { formatDateTime } from '@/core/i18n';
import { PDF_OPS } from '@/core/pdf-tools-catalog';
import { useToolHistory, type HistoryDocRef } from '../hooks/useToolHistory';

/** Props for {@link ToolHistoryList}. */
export interface ToolHistoryListProps {
  /** Only this tool's runs; omit for the combined history. */
  toolId?: string;
  /** Change to reload after a run. */
  refreshKey?: unknown;
  onOpen: (document: DocumentEntity) => void;
  /** Offer "Clear history" (combined view). */
  clearable?: boolean;
}

/** Recent tool runs, newest first. */
export function ToolHistoryList({
  toolId,
  refreshKey,
  onOpen,
  clearable = false,
}: ToolHistoryListProps): ReactNode {
  const { t, i18n } = useTranslation('tools');
  const { entries, loading, clear } = useToolHistory(toolId, refreshKey);
  const prefix = toolId ? `pdf-tools.history-${toolId}` : 'pdf-tools.history';

  const name = (ref: HistoryDocRef): string => ref.doc?.name ?? t('history.deleted');

  // TS-10 (progressive disclosure): a tool's own history appears once it has
  // run; "Nothing yet" in every sheet is noise for a new user.
  if (toolId && (loading || entries.length === 0)) {
    return null;
  }

  return (
    <section className="kg-tool-history" data-agent-id={prefix} aria-labelledby={`${prefix}-title`}>
      <div className="kg-tool-history__header">
        <h2 className="kg-tool-history__title" id={`${prefix}-title`}>
          {toolId ? t('history.title_tool') : t('history.title_all')}
        </h2>
        {clearable && entries.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => void clear()} agentId={`${prefix}.clear`}>
            {t('history.clear')}
          </Button>
        )}
      </div>

      {!loading && entries.length === 0 && (
        <p className="kg-tool-history__empty" data-agent-id={`${prefix}.empty`}>
          {t('history.empty')}
        </p>
      )}

      <ul className="kg-tool-history__list">
        {entries.map(({ run, inputs, outputs }) => {
          const op = PDF_OPS.find((o) => o.id === run.toolId);
          const failed = run.status === 'failed';
          return (
            <li
              key={run.id}
              className="kg-tool-history__item"
              data-agent-id={`${prefix}.run-${run.id}`}
              data-agent-state={failed ? 'error' : 'idle'}
            >
              <div className="kg-tool-history__meta">
                {!toolId && (
                  <span className="kg-tool-history__tool">
                    <Icon name={op?.icon ?? 'FileText'} size={16} aria-hidden />
                    {op ? t(`ops.${op.id}`) : run.toolId}
                  </span>
                )}
                <time className="kg-tool-history__when" dateTime={run.createdAt}>
                  {formatDateTime(run.createdAt, i18n.language)}
                </time>
              </div>
              {inputs.length > 0 && (
                <p className="kg-tool-history__inputs">
                  {t('history.from', { names: inputs.map(name).join(', ') })}
                </p>
              )}
              {failed ? (
                <p className="kg-tool-history__failed">{t('history.failed')}</p>
              ) : (
                <ul className="kg-tool-history__outputs">
                  {outputs.map((ref) => (
                    <li key={ref.id}>
                      {ref.doc ? (
                        <button
                          type="button"
                          className="kg-tool-history__output"
                          onClick={() => ref.doc && onOpen(ref.doc)}
                          data-agent-id={`${prefix}.open-${ref.id}`}
                        >
                          <DocumentThumb document={ref.doc} iconSize={20} />
                          <span className="kg-tool-history__output-name">{ref.doc.name}</span>
                        </button>
                      ) : (
                        <span className="kg-tool-history__output kg-tool-history__output--gone">
                          <span className="kg-tool-history__output-name">{name(ref)}</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
