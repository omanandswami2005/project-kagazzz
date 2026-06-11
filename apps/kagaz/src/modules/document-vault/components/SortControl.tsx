/**
 * Sort control (02-document-vault-module.md §Sort Options): pick a sort
 * key and flip direction. Drives the vault store; the list re-orders
 * client-side (F-34).
 */
import { IonSelect, IonSelectOption } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Button, Icon } from '@kagaz/ui';
import { useVaultStore } from '../store/vault.store';
import {
  SORT_KEYS,
  SORT_KEY_LABELS,
  type SortKey,
} from '../services/sort.service';

/** Sort-by picker + ascending/descending toggle for the vault list. */
export function SortControl(): ReactNode {
  const { t } = useTranslation('documents');
  const sortBy = useVaultStore((s) => s.sortBy);
  const sortDirection = useVaultStore((s) => s.sortDirection);
  const setSortBy = useVaultStore((s) => s.setSortBy);
  const toggleSortDirection = useVaultStore((s) => s.toggleSortDirection);

  return (
    <div className="kg-vault__sort" data-agent-id="vault.home.sort">
      <IonSelect
        className="kg-vault__sort-select"
        value={sortBy}
        interface="popover"
        aria-label={t('sort.label')}
        data-agent-id="vault.home.sort-key"
        data-agent-action="vault.setSortBy"
        onIonChange={(e) => setSortBy(e.detail.value as SortKey)}
      >
        {SORT_KEYS.map((key) => (
          <IonSelectOption key={key} value={key}>
            {t(SORT_KEY_LABELS[key])}
          </IonSelectOption>
        ))}
      </IonSelect>
      <Button
        variant="ghost"
        size="sm"
        iconOnly
        onClick={toggleSortDirection}
        agentId="vault.home.sort-direction"
        agentAction="vault.toggleSortDirection"
        aria-label={t(
          sortDirection === 'asc' ? 'sort.ascending' : 'sort.descending'
        )}
        icon={
          <Icon name={sortDirection === 'asc' ? 'ChevronUp' : 'ChevronDown'} />
        }
      />
    </div>
  );
}
