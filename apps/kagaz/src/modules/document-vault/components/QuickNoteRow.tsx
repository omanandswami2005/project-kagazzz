/**
 * One Quick Notes row (UX pass 2026-07-24, device-testing follow-up): the
 * whole row is now the copy action — the fastest possible tap-to-copy,
 * since Quick Notes exists specifically for zero-friction access. Edit
 * moved into the "more" menu (it was already there); long-press enters
 * multiselect, same interaction-patterns.md "Long-press (500ms)" gesture
 * DocumentListItem already uses, via the shared `useLongPress` hook.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@kagaz/ui';
import { useLongPress } from '@/core/gestures';
import { detectIdNumbers, type DetectedId } from '@/core/id-numbers';
import type { QuickReferenceEntry } from '@/infrastructure/database/types';

/** Props for {@link QuickNoteRow}. */
export interface QuickNoteRowProps {
  entry: QuickReferenceEntry;
  selectionMode: boolean;
  selected: boolean;
  /** Tap while not in selection mode — copies the value. */
  onCopy: (entry: QuickReferenceEntry) => void;
  /** Tap while in selection mode — toggles this row's selection. */
  onToggleSelect: (entry: QuickReferenceEntry) => void;
  /** Long-press — enters selection mode with this row selected. */
  onLongPress: (entry: QuickReferenceEntry) => void;
  /** Opens the overflow menu (copy with title, edit, delete). */
  onMore: (entry: QuickReferenceEntry) => void;
  /** QN-2: moves an ID-looking note into the locked Quick Reference. */
  onMoveToQuickReference?: (entry: QuickReferenceEntry, id: DetectedId) => void;
}

/** One label+value row — tap copies, long-press selects, "more" opens the menu. */
export function QuickNoteRow({
  entry,
  selectionMode,
  selected,
  onCopy,
  onToggleSelect,
  onLongPress,
  onMore,
  onMoveToQuickReference,
}: QuickNoteRowProps): ReactNode {
  const { t } = useTranslation('documents');
  // QN-2: Quick Notes is unlocked by design — an ID number doesn't belong here.
  const id = onMoveToQuickReference ? detectIdNumbers(`${entry.label} ${entry.value}`)[0] : undefined;
  const longPress = useLongPress(() => onLongPress(entry), !selectionMode);

  const handleClick = (): void => {
    if (longPress.consumeTrailingClick()) return;
    if (selectionMode) {
      onToggleSelect(entry);
    } else {
      onCopy(entry);
    }
  };

  return (
    <li className="kg-quickref__item">
      <button
        type="button"
        className="kg-quickref__row"
        onClick={handleClick}
        aria-pressed={selectionMode ? selected : undefined}
        data-agent-id={`vault.quick-notes.item-${entry.id}`}
        data-agent-state={selectionMode && selected ? 'selected' : 'idle'}
        {...longPress.bind}
      >
        {selectionMode && (
          <span className="kg-quickref__check" aria-hidden="true">
            <Icon
              name={selected ? 'Check' : 'File'}
              size={20}
              color={selected ? 'var(--color-primary)' : 'var(--text-muted)'}
            />
          </span>
        )}
        <span className="kg-quickref__row-text">
          <span className="kg-quickref__label">{entry.label}</span>
          {/* No mask/reveal — Quick Notes is for data that doesn't need it;
              shown plainly for the fastest possible read. */}
          <span className="kg-quickref__value">{entry.value}</span>
        </span>
      </button>
      {!selectionMode && (
        <div className="kg-quickref__actions">
          <button
            type="button"
            className="kg-quickref__action"
            aria-label={t('quick_notes.more_actions')}
            onClick={() => onMore(entry)}
            data-agent-id={`vault.quick-notes.item-${entry.id}.more`}
          >
            <Icon name="MoreVertical" size={20} color="var(--text-muted)" />
          </button>
        </div>
      )}
      {id && !selectionMode && onMoveToQuickReference && (
        <div className="kg-quicknote__move" data-agent-id={`vault.quick-notes.item-${entry.id}.id-hint`}>
          <Icon name="ShieldCheck" size={16} />
          <span>{t('quick_reference.move_hint')}</span>
          <button
            type="button"
            className="kg-quicknote__move-btn"
            onClick={() => onMoveToQuickReference(entry, id)}
            data-agent-id={`vault.quick-notes.item-${entry.id}.move`}
          >
            {t('quick_reference.move')}
          </button>
        </div>
      )}
    </li>
  );
}
