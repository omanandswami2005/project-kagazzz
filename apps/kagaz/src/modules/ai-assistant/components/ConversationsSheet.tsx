/** Saved conversations: open one or delete it. */
import { IonModal } from '@ionic/react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@kagaz/ui';
import type { AiConversationEntity } from '@/infrastructure/database/types';

export interface ConversationsSheetProps {
  isOpen: boolean;
  conversations: AiConversationEntity[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onDismiss: () => void;
}

const dateLabel = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
};

export function ConversationsSheet({
  isOpen,
  conversations,
  activeId,
  onOpen,
  onDelete,
  onDismiss,
}: ConversationsSheetProps): ReactNode {
  const { t } = useTranslation('ai-assistant');
  return (
    <IonModal isOpen={isOpen} onDidDismiss={onDismiss} data-agent-id="ai.chat.history-sheet">
      <div className="kg-chat__history">
        <header className="kg-chat__history-head">
          <h2>{t('history.title')}</h2>
          <Button variant="ghost" size="sm" onClick={onDismiss} agentId="ai.chat.history-close">
            <Icon name="X" size={20} aria-label={t('history.close')} />
          </Button>
        </header>
        {conversations.length === 0 ? (
          <p className="kg-ai-settings__hint">{t('history.empty')}</p>
        ) : (
          <ul className="kg-chat__history-list">
            {conversations.map((c) => (
              <li
                key={c.id}
                className={`kg-chat__history-item${c.id === activeId ? ' kg-chat__history-item--active' : ''}`}
                data-agent-id={`ai.chat.history-item-${c.id}`}
              >
                <button
                  type="button"
                  className="kg-chat__history-open"
                  onClick={() => onOpen(c.id)}
                  aria-current={c.id === activeId}
                >
                  <span className="kg-chat__history-name">{c.title || t('history.untitled')}</span>
                  <span className="kg-chat__history-date">{dateLabel(c.updatedAt)}</span>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(c.id)}
                  agentId={`ai.chat.history-delete-${c.id}`}
                >
                  <Icon
                    name="Trash2"
                    size={20}
                    aria-label={t('history.delete', { name: c.title || t('history.untitled') })}
                  />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </IonModal>
  );
}
