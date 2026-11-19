/**
 * Empty vault illustration + copy (02-document-vault-module.md
 * §Module File Structure). Audit VH-12 (next best action): a new user's
 * first job is adding a document, so the primary button does exactly that
 * — Scan where the scanner exists, otherwise Add from files — with the
 * other source second and starter folders as a quiet third option.
 */
import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import { Button, EmptyState, Icon } from '@kagaz/ui';
import { isScanningSupported } from '@/modules/document-scanner/services/scanner.service';
import type { UploadSource } from '../services/upload-sources';

/** Props for {@link EmptyVaultState}. */
export interface EmptyVaultStateProps {
  /** Starts an upload from the given source. */
  onAdd: (source: UploadSource) => void;
  /** Offers to create the starter folders (F-30) when provided. */
  onSetUpFolders?: () => void;
}

/** Friendly first-run state when the vault has no documents. */
export function EmptyVaultState({
  onAdd,
  onSetUpFolders,
}: EmptyVaultStateProps): ReactNode {
  const { t } = useTranslation('documents');
  const canScan = isScanningSupported();
  return (
    <EmptyState
      icon="FolderOpen"
      title={t('empty_state.message')}
      hint={t('empty_state.hint')}
      agentId="vault.home.empty-state"
      action={
        <div className="kg-vault-empty__actions">
          {canScan && (
            <Button
              icon={<Icon name="Scan" size={20} />}
              onClick={() => onAdd('scanner')}
              fullWidth
              agentId="vault.home.empty-scan"
              agentRole="primary-action"
              agentAction="vault.uploadDocument"
            >
              {t('upload.sources.scan')}
            </Button>
          )}
          <Button
            variant={canScan ? 'secondary' : 'primary'}
            icon={<Icon name="Upload" size={20} />}
            onClick={() => onAdd('files')}
            fullWidth
            agentId="vault.home.empty-files"
            agentRole={canScan ? 'secondary-action' : 'primary-action'}
            agentAction="vault.uploadDocument"
          >
            {t('upload.sources.files')}
          </Button>
          {onSetUpFolders && (
            <Button
              variant="ghost"
              icon={<Icon name="FolderPlus" size={20} />}
              onClick={onSetUpFolders}
              agentId="vault.home.setup-folders"
              agentAction="vault.createStarterFolders"
            >
              {t('templates.cta')}
            </Button>
          )}
        </div>
      }
    />
  );
}
