/**
 * Upload FAB drawer (02-document-vault-module.md §Upload Pipeline) — the
 * screen's one primary action (design-principles.md #1). UX pass
 * 2026-07-25: a tap now reveals a 3-item speed-dial (Upload / New Folder /
 * Quick Note) via Ionic's real ion-fab + ion-fab-list, instead of a single
 * button — New Folder moved off the folder-bar (interaction-patterns.md's
 * "one FAB max per screen" already treats this FAB as the screen's picker
 * entry point, e.g. "opens a sheet: Scan, Upload, Import"; a speed-dial is
 * the same pattern one level up) and Quick Note gets a fast, straight-to-
 * composer entry point it never had before (previously reachable only via
 * the header icon, which opens the list). ion-fab-button's built-in click
 * handler toggles any sibling ion-fab-list automatically and swaps the main
 * button's icon to a close "X" while open — no extra open/close state needed
 * here; tapping any drawer item both fires its handler and auto-collapses
 * the drawer (the same built-in toggle fires on every fab-button click
 * inside the ion-fab).
 */
import { IonFab, IonFabButton, IonFabList } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { useAgentProps } from '@kagaz/agent-kit';
import { Icon } from '@kagaz/ui';
import './upload-fab.css';

/** Props for {@link UploadFAB}. */
export interface UploadFABProps {
  /** Disabled until the database is ready, or while an upload is running — disables the whole drawer, not just Upload. */
  disabled?: boolean;
  /** Opens the upload options sheet. */
  onUpload: () => void;
  /** Opens the new-folder dialog (moved off the folder bar, UX pass 2026-07-25). */
  onNewFolder: () => void;
  /** Navigates to Quick Notes with the add-note composer open. */
  onQuickNote: () => void;
}

/** Floating "+" button that expands into Upload / New Folder / Quick Note. */
export function UploadFAB({
  disabled = false,
  onUpload,
  onNewFolder,
  onQuickNote,
}: UploadFABProps): ReactNode {
  const { t } = useTranslation('documents');
  const mainProps = useAgentProps({
    id: 'vault.home.upload-fab',
    action: 'vault.uploadDocument',
    role: 'primary-action',
    state: disabled ? 'disabled' : 'idle',
  });
  const uploadProps = useAgentProps({
    id: 'vault.home.upload-fab-upload',
    action: 'vault.uploadDocument',
    role: 'secondary-action',
    state: disabled ? 'disabled' : 'idle',
  });
  const newFolderProps = useAgentProps({
    id: 'vault.home.upload-fab-new-folder',
    action: 'vault.createFolder',
    role: 'secondary-action',
    state: 'idle',
  });
  const quickNoteProps = useAgentProps({
    id: 'vault.home.upload-fab-quick-note',
    action: 'vault.startQuickNote',
    role: 'secondary-action',
    state: 'idle',
  });

  return (
    <IonFab slot="fixed" vertical="bottom" horizontal="end">
      <IonFabButton
        disabled={disabled}
        aria-label={t('fab.label')}
        className="kg-upload-fab"
        {...mainProps}
      >
        <Icon name="Plus" size={24} />
      </IonFabButton>
      <IonFabList side="top">
        <IonFabButton
          onClick={onUpload}
          disabled={disabled}
          aria-label={t('actions.upload')}
          className="kg-upload-fab-item"
          {...uploadProps}
        >
          <Icon name="Upload" size={20} />
        </IonFabButton>
        <IonFabButton
          onClick={onNewFolder}
          aria-label={t('folders.new')}
          className="kg-upload-fab-item"
          {...newFolderProps}
        >
          <Icon name="FolderPlus" size={20} />
        </IonFabButton>
        <IonFabButton
          onClick={onQuickNote}
          aria-label={t('quick_notes.new_note')}
          className="kg-upload-fab-item"
          {...quickNoteProps}
        >
          <Icon name="StickyNote" size={20} />
        </IonFabButton>
      </IonFabList>
    </IonFab>
  );
}
