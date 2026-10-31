/** Renders the structured parts of a chat message: attached documents and created-document result cards. */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@kagaz/ui';
import type { DocRef } from '../types/message-parts';

const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'tiff']);
const iconFor = (fileType: string): 'FileImage' | 'FileText' =>
  IMAGE_TYPES.has(fileType.toLowerCase()) ? 'FileImage' : 'FileText';

/** Chips for the documents attached to a user message (read-only), or removable ones in the composer. */
export function AttachmentChips({
  documents,
  onRemove,
  idPrefix = 'ai.chat.attachment',
}: {
  documents: DocRef[];
  onRemove?: (id: string) => void;
  idPrefix?: string;
}): ReactNode {
  const { t } = useTranslation('ai-assistant');
  return (
    <ul className="kg-chat__chips" data-agent-id={`${idPrefix}s`}>
      {documents.map((doc) => (
        <li key={doc.id} className="kg-chat__chip" data-agent-id={`${idPrefix}-${doc.id}`}>
          <Icon name={iconFor(doc.fileType)} size={16} aria-hidden />
          <span className="kg-chat__chip-name">{doc.name}</span>
          {onRemove && (
            <button
              type="button"
              className="kg-chat__chip-remove"
              aria-label={t('attach.remove', { name: doc.name })}
              onClick={() => onRemove(doc.id)}
              data-agent-id={`${idPrefix}-remove-${doc.id}`}
            >
              <Icon name="X" size={16} aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** The card shown when a tool created documents — each one opens in the viewer. */
export function ResultCard({
  documents,
  onOpen,
}: {
  documents: DocRef[];
  onOpen: (id: string) => void;
}): ReactNode {
  const { t } = useTranslation('ai-assistant');
  return (
    <div
      className="kg-chat__result"
      role="group"
      aria-label={t('result.title')}
      data-agent-id="ai.chat.result-card"
    >
      <span className="kg-chat__result-title">{t('result.title')}</span>
      <ul className="kg-chat__result-list">
        {documents.map((doc) => (
          <li key={doc.id} className="kg-chat__result-item">
            <Icon name={iconFor(doc.fileType)} size={20} aria-hidden />
            <span className="kg-chat__chip-name">{doc.name}</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onOpen(doc.id)}
              agentId={`ai.chat.result-open-${doc.id}`}
            >
              <Icon name="ExternalLink" size={16} aria-hidden /> {t('result.open')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "pdf.mergePdfs" → "Merge pdfs": a readable label for a tool id when no summary is known. */
function toolLabel(name: string): string {
  const last = name.split('.').pop() ?? name;
  const words = last.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** One chip per tool the assistant ran: what it did and whether it worked (the reason shows when it failed). */
export function ToolChip({
  name,
  ok,
  error,
  label,
}: {
  name: string;
  ok: boolean;
  error?: string;
  label?: string;
}): ReactNode {
  const { t } = useTranslation('ai-assistant');
  return (
    <div
      className={`kg-chat__tool${ok ? '' : ' kg-chat__tool--failed'}`}
      role="status"
      data-agent-id={`ai.chat.tool-${name}`}
      data-agent-state={ok ? 'ok' : 'failed'}
    >
      <Icon name={ok ? 'Check' : 'AlertCircle'} size={16} aria-hidden />
      <span className="kg-chat__tool-name">{label ?? toolLabel(name)}</span>
      {!ok && <span className="kg-chat__tool-error">{error || t('tool.failed')}</span>}
    </div>
  );
}
