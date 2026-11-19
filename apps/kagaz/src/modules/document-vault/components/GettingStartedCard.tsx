/**
 * "Getting started" (first-run journey, 2026-11-19): a short checklist on the
 * Documents screen once the first document is in. Every item is ticked by
 * real state — nothing to mark by hand — so it can't drift from what the user
 * actually did: a folder exists, something is starred, the app lock is on, a
 * backup was made. Hidden once everything is done, or when dismissed.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, ListRow, type IconName } from '@kagaz/ui';

/** One checklist entry. */
export interface GettingStartedItem {
  id: 'add' | 'folder' | 'star' | 'lock' | 'backup';
  icon: IconName;
  done: boolean;
  onStart: () => void;
}

/** Props for {@link GettingStartedCard}. */
export interface GettingStartedCardProps {
  items: GettingStartedItem[];
  onDismiss: () => void;
}

/** The checklist card; renders nothing once every item is done. */
export function GettingStartedCard({ items, onDismiss }: GettingStartedCardProps): ReactNode {
  const { t } = useTranslation('documents');
  const done = items.filter((item) => item.done).length;
  if (done === items.length) return null;
  return (
    <section className="kg-getting-started" data-agent-id="vault.home.getting-started" aria-labelledby="kg-getting-started-title">
      <div className="kg-getting-started__head">
        <div>
          <h2 id="kg-getting-started-title" className="kg-getting-started__title">
            {t('getting_started.title')}
          </h2>
          <p className="kg-getting-started__progress">
            {t('getting_started.progress', { done, total: items.length })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={<Icon name="X" size={20} />}
          aria-label={t('getting_started.dismiss')}
          onClick={onDismiss}
          agentId="vault.home.getting-started.dismiss"
        />
      </div>
      <div
        className="kg-getting-started__bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={done}
        aria-label={t('getting_started.progress', { done, total: items.length })}
      >
        <span style={{ width: `${(done / items.length) * 100}%` }} />
      </div>
      <ul className="kg-getting-started__list">
        {items.map((item) => (
          <li
            key={item.id}
            className={item.done ? 'kg-getting-started__item--done' : undefined}
            data-agent-state={item.done ? 'success' : 'idle'}
          >
            <ListRow
              icon={item.done ? 'Check' : item.icon}
              title={t(`getting_started.${item.id}.title`)}
              hint={item.done ? undefined : t(`getting_started.${item.id}.hint`)}
              disabled={item.done}
              noChevron={item.done}
              onClick={item.onStart}
              agentId={`vault.home.getting-started.${item.id}`}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
