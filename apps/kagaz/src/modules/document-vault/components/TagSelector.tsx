/**
 * Tag selector sheet (02-document-vault-module.md §Tag System): toggle a
 * document's tags and create new ones. Takes its `useTags()` slice as props
 * from the caller (rather than calling the hook itself) so it shares one
 * `tagsByDocument` snapshot with the vault list — two independent `useTags()`
 * instances each keep their own local state, so the list's chips wouldn't
 * see a tag assigned here until something else forced a remount (F-10).
 */
import { IonModal } from '@ionic/react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Tag } from '@kagaz/ui';
import type { TagEntity } from '@/infrastructure/database/types';
import type { UseTagsResult } from '../hooks/useTags';

/** Props for {@link TagSelector}. */
export interface TagSelectorProps
  extends Pick<
    UseTagsResult,
    'tags' | 'tagsByDocument' | 'createTag' | 'assignTag' | 'removeTag'
  > {
  /** Document being tagged; null closes the sheet. */
  documentId: string | null;
  onDismiss: () => void;
}

/** Bottom sheet to assign/remove/create tags for one document. */
export function TagSelector({
  documentId,
  onDismiss,
  tags,
  tagsByDocument,
  createTag,
  assignTag,
  removeTag,
}: TagSelectorProps): ReactNode {
  const { t } = useTranslation('documents');
  const [newName, setNewName] = useState('');

  const assigned = new Set(
    (documentId ? tagsByDocument.get(documentId) : undefined)?.map((x) => x.id)
  );

  const toggle = (tag: TagEntity): void => {
    if (!documentId) {
      return;
    }
    void (assigned.has(tag.id)
      ? removeTag(documentId, tag.id)
      : assignTag(documentId, tag.id));
  };

  const handleCreate = (): void => {
    const name = newName.trim();
    if (!name || !documentId) {
      return;
    }
    void createTag(name).then((tag) => {
      if (tag) {
        void assignTag(documentId, tag.id);
      }
    });
    setNewName('');
  };

  return (
    <IonModal
      isOpen={documentId !== null}
      onDidDismiss={onDismiss}
      initialBreakpoint={0.5}
      breakpoints={[0, 0.5, 0.9]}
      data-agent-id="vault.home.tag-sheet"
      data-agent-state={documentId !== null ? 'expanded' : 'collapsed'}
      aria-label={t('tags.title')}
    >
      <div className="kg-tag-sheet">
        <h2 className="kg-tag-sheet__title">{t('tags.title')}</h2>

        <div className="kg-tag-sheet__list" data-agent-id="vault.home.tag-list">
          {tags.length === 0 ? (
            <p className="kg-tag-sheet__empty">{t('tags.empty')}</p>
          ) : (
            tags.map((tag) => (
              <Tag
                key={tag.id}
                label={tag.name}
                color={tag.color ?? undefined}
                selected={assigned.has(tag.id)}
                onClick={() => toggle(tag)}
                agentId={`vault.home.tag-${tag.id}`}
                agentAction="vault.assignTag"
              />
            ))
          )}
        </div>

        <div className="kg-tag-sheet__create">
          <Input
            label={t('tags.new_placeholder')}
            value={newName}
            placeholder={t('tags.new_placeholder')}
            agentId="vault.home.tag-new-input"
            onChange={setNewName}
          />
          <Button
            variant="secondary"
            size="md"
            disabled={newName.trim().length === 0}
            onClick={handleCreate}
            agentId="vault.home.tag-create"
            agentAction="vault.createTag"
          >
            {t('tags.create')}
          </Button>
        </div>
      </div>
    </IonModal>
  );
}
