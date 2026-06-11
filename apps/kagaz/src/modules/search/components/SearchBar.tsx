/**
 * Search bar (02-document-vault-module.md §Search Engine): the vault's
 * full-text search input (F-11). Controlled by useSearch; debounce and
 * querying live in the hook.
 */
import { IonSearchbar } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';

/** Props for {@link SearchBar}. */
export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

/** Debounced document search input. */
export function SearchBar({ value, onChange }: SearchBarProps): ReactNode {
  const { t } = useTranslation('documents');
  return (
    <IonSearchbar
      className="kg-vault__search"
      value={value}
      placeholder={t('search.placeholder')}
      aria-label={t('search.placeholder')}
      data-agent-id="vault.home.search"
      data-agent-action="vault.searchDocuments"
      data-agent-state={value ? 'dirty' : 'pristine'}
      data-agent-value={value}
      onIonInput={(e) => onChange(e.detail.value ?? '')}
    />
  );
}
