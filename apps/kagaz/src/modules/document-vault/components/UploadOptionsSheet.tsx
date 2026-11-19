/**
 * Upload source picker sheet (02-document-vault-module.md §Input
 * Sources): camera, gallery, file picker, and the native scanner (F-2,
 * Android-only). Built on IonModal (sheet breakpoints) so every option is
 * a real Button with full agent + a11y surface.
 */
import { IonModal } from '@ionic/react';
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { ListRow } from '@kagaz/ui';
import { isScanningSupported } from '@/modules/document-scanner/services/scanner.service';
import type { UploadSource } from '../services/upload-sources';

/** Props for {@link UploadOptionsSheet}. */
export interface UploadOptionsSheetProps {
  isOpen: boolean;
  onDismiss: () => void;
  /** Invoked with the chosen source; the sheet closes itself first. */
  onSelect: (source: UploadSource) => void;
}

const OPTIONS = [
  { source: 'scanner', labelKey: 'upload.sources.scan', icon: 'Scan' },
  { source: 'camera', labelKey: 'upload.sources.camera', icon: 'Camera' },
  { source: 'gallery', labelKey: 'upload.sources.gallery', icon: 'Images' },
  { source: 'files', labelKey: 'upload.sources.files', icon: 'FolderOpen' },
] as const satisfies readonly {
  source: UploadSource;
  labelKey: string;
  icon: 'Camera' | 'Images' | 'FolderOpen' | 'Scan';
}[];

/** Bottom sheet listing the upload input sources. */
export function UploadOptionsSheet({
  isOpen,
  onDismiss,
  onSelect,
}: UploadOptionsSheetProps): ReactNode {
  const { t } = useTranslation('documents');
  // The scanner is Android-only (Play Services); hide it where unavailable.
  const options = OPTIONS.filter(
    (option) => option.source !== 'scanner' || isScanningSupported()
  );
  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onDismiss}
      // UP-3: the sheet is as tall as its rows, not 60 % of the screen.
      className="kg-sheet-auto"
      initialBreakpoint={1}
      breakpoints={[0, 1]}
      data-agent-id="vault.home.upload-sheet"
      data-agent-state={isOpen ? 'expanded' : 'collapsed'}
      aria-label={t('upload.sheet_title')}
    >
      <div className="kg-upload-sheet">
        <h2 className="kg-upload-sheet__title">{t('upload.sheet_title')}</h2>
        {options.map(({ source, labelKey, icon }) => (
          <ListRow
            key={source}
            icon={icon}
            title={t(labelKey)}
            hint={t(`upload.source_hints.${source}`)}
            noChevron
            onClick={() => onSelect(source)}
            agentId={`vault.home.upload-source-${source}`}
            agentAction="vault.uploadDocument"
          />
        ))}
      </div>
    </IonModal>
  );
}
