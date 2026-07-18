/**
 * Bulk action bar (02-document-vault-module.md §Bulk Operations): the
 * floating toolbar shown in multi-select mode with the selection count
 * and the batch actions (F-25). Delete asks for confirmation.
 */
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionSheet, Icon } from '@kagaz/ui';

/** Props for {@link BulkActionBar}. */
export interface BulkActionBarProps {
  /** Number of selected documents. */
  count: number;
  onCancel: () => void;
  onDelete: () => void;
  onMove: () => void;
  onFavorite: () => void;
}

/** Floating multi-select toolbar. Hidden when nothing is selected. */
export function BulkActionBar({
  count,
  onCancel,
  onDelete,
  onMove,
  onFavorite,
}: BulkActionBarProps): ReactNode {
  const { t } = useTranslation('documents');
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div
      className="kg-bulk-bar"
      role="toolbar"
      aria-label={t('bulk.toolbar')}
      data-agent-id="vault.home.bulk-bar"
      data-agent-state={count > 0 ? 'selected' : 'idle'}
    >
      <button
        type="button"
        className="kg-bulk-bar__action"
        aria-label={t('bulk.cancel')}
        data-agent-id="vault.home.bulk-cancel"
        onClick={onCancel}
      >
        <Icon name="X" size={20} />
      </button>

      <span className="kg-bulk-bar__count" data-agent-id="vault.home.bulk-count">
        {t('bulk.selected', { count })}
      </span>

      <span className="kg-bulk-bar__actions">
        <button
          type="button"
          className="kg-bulk-bar__action"
          aria-label={t('actions.favorite')}
          data-agent-id="vault.home.bulk-favorite"
          data-agent-action="vault.bulkFavorite"
          disabled={count === 0}
          onClick={onFavorite}
        >
          <Icon name="Star" size={20} />
        </button>
        <button
          type="button"
          className="kg-bulk-bar__action"
          aria-label={t('folders.move')}
          data-agent-id="vault.home.bulk-move"
          disabled={count === 0}
          onClick={onMove}
        >
          <Icon name="Move" size={20} />
        </button>
        <button
          type="button"
          className="kg-bulk-bar__action kg-bulk-bar__action--danger"
          aria-label={t('bulk.delete')}
          data-agent-id="vault.home.bulk-delete"
          data-agent-action="vault.bulkDelete"
          disabled={count === 0}
          onClick={() => setConfirmOpen(true)}
        >
          <Icon name="Trash2" size={20} />
        </button>
      </span>

      <ActionSheet
        isOpen={confirmOpen}
        header={t('bulk.delete_confirm', { count })}
        agentId="vault.home.bulk-delete-confirm"
        onDidDismiss={() => setConfirmOpen(false)}
        buttons={[
          {
            text: t('bulk.delete'),
            role: 'destructive',
            handler: (): void => onDelete(),
          },
          { text: t('actions.cancel'), role: 'cancel' },
        ]}
      />
    </div>
  );
}

