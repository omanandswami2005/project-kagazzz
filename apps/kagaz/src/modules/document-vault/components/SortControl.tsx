/**
 * Sort control (02-document-vault-module.md §Sort Options): pick a sort
 * key and flip direction. Drives the vault store; the list re-orders
 * client-side (F-34).
 *
 * Uses `@kagaz/ui`'s `Select` (a native `<select>` under a styled trigger),
 * not Ionic's `IonSelect` — its `interface="popover"` could render wider
 * than the viewport for longer labels (e.g. "Recently opened") with nothing
 * to contain it, pushing this whole control (and the row it sits in)
 * outside the screen horizontally. `Select`'s options are drawn by the OS
 * shell, not app-managed CSS, so this can't happen structurally. First
 * component swapped for the G1-4 Ionic-overlay refactor.
 */
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Button, Icon, Select } from '@kagaz/ui';
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
      <Select
        value={sortBy}
        options={SORT_KEYS.map((key) => ({
          value: key,
          label: t(SORT_KEY_LABELS[key]),
        }))}
        onChange={(value) => setSortBy(value as SortKey)}
        aria-label={t('sort.label')}
        agentId="vault.home.sort-key"
        agentAction="vault.setSortBy"
      />
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
