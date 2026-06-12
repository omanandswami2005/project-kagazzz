/**
 * Empty vault illustration + copy (02-document-vault-module.md
 * §Module File Structure). The CTA is the Upload FAB — this surface
 * stays non-interactive so the screen keeps one primary action
 * (design-principles.md #1).
 */
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Button, Icon } from '@kagaz/ui';

/** Props for {@link EmptyVaultState}. */
export interface EmptyVaultStateProps {
  /** Offers to create the starter folders (F-30) when provided. */
  onSetUpFolders?: () => void;
}

/** Friendly first-run state when the vault has no documents. */
export function EmptyVaultState({
  onSetUpFolders,
}: EmptyVaultStateProps): ReactNode {
  const { t } = useTranslation('documents');
  return (
    <div className="kg-vault-empty" data-agent-id="vault.home.empty-state">
      <Icon name="FolderOpen" size={48} />
      <p className="kg-vault-empty__message">{t('empty_state.message')}</p>
      <p className="kg-vault-empty__hint">{t('empty_state.hint')}</p>
      {onSetUpFolders && (
        <Button
          variant="secondary"
          size="md"
          icon={<Icon name="FolderPlus" size={20} />}
          onClick={onSetUpFolders}
          agentId="vault.home.setup-folders"
          agentAction="vault.createStarterFolders"
        >
          {t('templates.cta')}
        </Button>
      )}
    </div>
  );
}
