/**
 * Search bar (02-document-vault-module.md §Search Engine): the vault's
 * full-text search input (F-11). Controlled by useSearch; debounce and
 * querying live in the hook.
 */
import { Search } from '@kagaz/ui';
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
    <Search
      value={value}
      placeholder={t('search.placeholder')}
      aria-label={t('search.placeholder')}
      agentId="vault.home.search"
      agentAction="vault.searchDocuments"
      onChange={onChange}
    />
  );
}
