/**
 * Empty vault illustration + copy (02-document-vault-module.md
 * §Module File Structure). The CTA is the Upload FAB — this surface
 * stays non-interactive so the screen keeps one primary action
 * (design-principles.md #1).
 */
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Icon } from '@kagaz/ui';

/** Friendly first-run state when the vault has no documents. */
export function EmptyVaultState(): ReactNode {
  const { t } = useTranslation('documents');
  return (
    <div className="kg-vault-empty" data-agent-id="vault.home.empty-state">
      <Icon name="FolderOpen" size={48} />
      <p className="kg-vault-empty__message">{t('empty_state.message')}</p>
      <p className="kg-vault-empty__hint">{t('empty_state.hint')}</p>
    </div>
  );
}
