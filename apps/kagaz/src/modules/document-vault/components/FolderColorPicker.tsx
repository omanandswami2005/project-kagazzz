/**
 * Folder color picker (02-document-vault-module.md §Folder Organization,
 * F-9): pick one of `FOLDER_COLORS` for a folder, or clear back to the
 * design system's default. Opened from the folder-options sheet.
 */
import { IonModal } from '@ionic/react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@kagaz/ui';
import type { FolderEntity } from '@/infrastructure/database/types';
import { FOLDER_COLORS } from '../services/folder-templates';
import './folder-color-picker.css';

/** Props for {@link FolderColorPicker}. */
export interface FolderColorPickerProps {
  /** Folder being recolored; null closes the sheet. */
  folder: FolderEntity | null;
  onDismiss: () => void;
  /** Called with the chosen color, or null to clear it. */
  onSelect: (color: string | null) => void;
}

/** Bottom sheet of color swatches for one folder. */
export function FolderColorPicker({
  folder,
  onDismiss,
  onSelect,
}: FolderColorPickerProps): ReactNode {
  const { t } = useTranslation('documents');

  return (
    <IonModal
      isOpen={folder !== null}
      onDidDismiss={onDismiss}
      initialBreakpoint={0.4}
      breakpoints={[0, 0.4]}
      data-agent-id="vault.home.folder-color-sheet"
      data-agent-state={folder !== null ? 'expanded' : 'collapsed'}
      aria-label={t('folders.color_picker_title')}
    >
      <div className="kg-folder-colors">
        <h2 className="kg-folder-colors__title">
          {t('folders.color_picker_title')}
        </h2>
        <div className="kg-folder-colors__grid">
          <button
            type="button"
            className="kg-folder-colors__swatch kg-folder-colors__swatch--default"
            data-agent-id="vault.home.folder-color-default"
            aria-label={t('folders.color_default')}
            aria-pressed={!folder?.color}
            onClick={() => onSelect(null)}
          >
            <Icon name="X" size={20} />
          </button>
          {FOLDER_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="kg-folder-colors__swatch"
              style={{ backgroundColor: color }}
              data-agent-id={`vault.home.folder-color-${color.replace('#', '')}`}
              aria-label={color}
              aria-pressed={folder?.color === color}
              onClick={() => onSelect(color)}
            >
              {folder?.color === color && (
                <Icon name="Check" size={20} color="white" />
              )}
            </button>
          ))}
        </div>
      </div>
    </IonModal>
  );
}
