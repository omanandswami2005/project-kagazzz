/**
 * A sample entry on an empty Quick reference / Quick notes screen (first-run
 * journey, 2026-11-19): one made-up row, drawn like a real one but dashed and
 * labelled "Example", so the idea is concrete before anything is saved. Not
 * interactive and not stored — purely an illustration.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, type IconName } from '@kagaz/ui';

/** Props for {@link ExampleEntry}. */
export interface ExampleEntryProps {
  icon: IconName;
  label: string;
  value: string;
  /** Agent id of the illustration (read-only; nothing to press). */
  agentId: string;
}

/** A dashed, labelled, non-interactive sample row. */
export function ExampleEntry({ icon, label, value, agentId }: ExampleEntryProps): ReactNode {
  const { t } = useTranslation('documents');
  return (
    <figure className="kg-example-entry" data-agent-id={agentId} aria-label={t('example.label')}>
      <figcaption className="kg-example-entry__tag">{t('example.label')}</figcaption>
      <div className="kg-example-entry__row">
        <Icon name={icon} size={20} color="var(--text-secondary)" aria-hidden />
        <span className="kg-example-entry__text">
          <span className="kg-example-entry__label">{label}</span>
          <span className="kg-example-entry__value">{value}</span>
        </span>
        <Icon name="Copy" size={20} color="var(--text-muted)" aria-hidden />
      </div>
    </figure>
  );
}
