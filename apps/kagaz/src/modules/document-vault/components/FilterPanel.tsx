/**
 * Filter panel (02-document-vault-module.md §Filter System): pick file
 * kind, size bucket, tags, and favorites-only; combined with AND (F-12).
 * Edits a local draft and applies on confirm so partial selections don't
 * thrash the list.
 */
import { IonModal } from '@ionic/react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Tag, Toggle } from '@kagaz/ui';
import type { TagEntity } from '@/infrastructure/database/types';
import {
  EMPTY_FILTERS,
  type DocumentFilters,
  type FileKind,
  type SizeBucket,
} from '../services/filter.service';

/** Props for {@link FilterPanel}. */
export interface FilterPanelProps {
  isOpen: boolean;
  filters: DocumentFilters;
  tags: TagEntity[];
  onDismiss: () => void;
  onApply: (filters: DocumentFilters) => void;
  /** How many documents a draft would show — labels Apply live (audit FP-5). */
  countFor?: (filters: DocumentFilters) => number;
}

const KINDS = [
  { value: 'pdf', labelKey: 'filters.kind_pdf' },
  { value: 'image', labelKey: 'filters.kind_image' },
  { value: 'other', labelKey: 'filters.kind_other' },
] as const satisfies readonly { value: FileKind; labelKey: string }[];

const SIZES = [
  { value: 'lt1mb', labelKey: 'filters.size_lt1' },
  { value: '1to5mb', labelKey: 'filters.size_1to5' },
  { value: '5to25mb', labelKey: 'filters.size_5to25' },
  { value: 'gt25mb', labelKey: 'filters.size_gt25' },
] as const satisfies readonly { value: SizeBucket; labelKey: string }[];

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((x) => x !== value)
    : [...list, value];
}

/** Bottom sheet for choosing the active document filters. */
export function FilterPanel({
  isOpen,
  filters,
  tags,
  onDismiss,
  onApply,
  countFor,
}: FilterPanelProps): ReactNode {
  const { t } = useTranslation('documents');
  // Seeded from the active filters; the parent remounts (via key) on open
  // so this starts fresh each time without a setState-in-effect.
  const [draft, setDraft] = useState<DocumentFilters>(filters);
  const draftCount = countFor?.(draft);

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      // FP-4: fit the sheet to its content.
      className="kg-sheet-auto"
      initialBreakpoint={1}
      breakpoints={[0, 1]}
      data-agent-id="vault.home.filter-sheet"
      data-agent-state={isOpen ? 'expanded' : 'collapsed'}
      aria-label={t('filters.title')}
    >
      <div className="kg-filter-sheet">
        <h2 className="kg-filter-sheet__title">{t('filters.title')}</h2>

        <section>
          <h3 className="kg-filter-sheet__heading">{t('filters.type')}</h3>
          <div className="kg-filter-sheet__chips">
            {KINDS.map(({ value, labelKey }) => (
              <Tag
                key={value}
                label={t(labelKey)}
                selected={draft.kinds.includes(value)}
                onClick={() =>
                  setDraft((d) => ({ ...d, kinds: toggle(d.kinds, value) }))
                }
                agentId={`vault.home.filter-kind-${value}`}
              />
            ))}
          </div>
        </section>

        <section>
          <h3 className="kg-filter-sheet__heading">{t('filters.size')}</h3>
          <div className="kg-filter-sheet__chips">
            {SIZES.map(({ value, labelKey }) => (
              <Tag
                key={value}
                label={t(labelKey)}
                selected={draft.sizes.includes(value)}
                onClick={() =>
                  setDraft((d) => ({ ...d, sizes: toggle(d.sizes, value) }))
                }
                agentId={`vault.home.filter-size-${value}`}
              />
            ))}
          </div>
        </section>

        {tags.length > 0 && (
          <section>
            <h3 className="kg-filter-sheet__heading">{t('filters.tags')}</h3>
            <div className="kg-filter-sheet__chips">
              {tags.map((tag) => (
                <Tag
                  key={tag.id}
                  label={tag.name}
                  color={tag.color ?? undefined}
                  selected={draft.tagIds.includes(tag.id)}
                  onClick={() =>
                    setDraft((d) => ({ ...d, tagIds: toggle(d.tagIds, tag.id) }))
                  }
                  agentId={`vault.home.filter-tag-${tag.id}`}
                />
              ))}
            </div>
          </section>
        )}

        <Toggle
          enabled={draft.favoritesOnly}
          label={t('filters.favorites_only')}
          agentId="vault.home.filter-favorites"
          onChange={(checked) =>
            setDraft((d) => ({ ...d, favoritesOnly: checked }))
          }
        />

        <div className="kg-filter-sheet__actions">
          <Button
            variant="ghost"
            onClick={() => {
              setDraft(EMPTY_FILTERS);
              onApply(EMPTY_FILTERS);
            }}
            agentId="vault.home.filter-clear"
            agentAction="vault.clearFilters"
          >
            {t('filters.clear')}
          </Button>
          <Button
            variant="primary"
            onClick={() => onApply(draft)}
            disabled={draftCount === 0}
            agentId="vault.home.filter-apply"
          >
            {draftCount === undefined ? (
              t('filters.apply')
            ) : (
              // FP-6: the count ticks (re-mounts with a pop) as filters change.
              <span key={draftCount} className="kg-filter-sheet__count">
                {t('filters.show_count', { count: draftCount })}
              </span>
            )}
          </Button>
        </div>
      </div>
    </IonModal>
  );
}
