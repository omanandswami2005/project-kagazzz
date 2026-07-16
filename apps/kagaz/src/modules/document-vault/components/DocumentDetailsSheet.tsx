/**
 * Document details sheet (F-67): a read-only summary of one vault document —
 * name, type, size, dates, original filename, integrity hash, and lock/favorite
 * status. All from data already on the {@link DocumentEntity}; no I/O.
 */
import {
  IonButtons,
  IonContent,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@kagaz/ui';
import { useLocale } from '@/core/i18n';
import { formatDateTime, formatFileSize, toFormattingLocale } from '@/core/i18n/utils';
import type { DocumentEntity } from '@/infrastructure/database/types';
import './document-details.css';

/** Props for {@link DocumentDetailsSheet}. */
export interface DocumentDetailsSheetProps {
  /** The document to describe, or null when the sheet is closed. */
  document: DocumentEntity | null;
  onClose: () => void;
}

/** One label/value row. */
function Row({ label, value }: { label: string; value: string }): ReactNode {
  return (
    <div className="kg-doc-details__row">
      <dt className="kg-doc-details__label">{label}</dt>
      <dd className="kg-doc-details__value">{value}</dd>
    </div>
  );
}

/** Read-only document details modal. */
export function DocumentDetailsSheet({
  document,
  onClose,
}: DocumentDetailsSheetProps): ReactNode {
  const { t } = useTranslation('documents');
  const { locale } = useLocale();
  const fmt = toFormattingLocale(locale);

  return (
    <IonModal
      isOpen={document !== null}
      onDidDismiss={onClose}
      data-agent-id="vault.details"
      data-agent-state={document ? 'open' : 'closed'}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>{t('details.title')}</IonTitle>
          <IonButtons slot="end">
            <Button variant="ghost" size="sm" onClick={onClose} agentId="vault.details.close">
              <Icon name="X" size={24} aria-label={t('actions.cancel')} />
            </Button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {document && (
          <dl className="kg-doc-details" data-agent-id="vault.details.content">
            <Row label={t('details.name')} value={document.name} />
            <Row label={t('details.type')} value={document.fileType.toUpperCase()} />
            <Row label={t('details.size')} value={formatFileSize(document.fileSize, fmt)} />
            <Row label={t('details.added')} value={formatDateTime(document.createdAt, fmt)} />
            {document.updatedAt !== document.createdAt && (
              <Row label={t('details.modified')} value={formatDateTime(document.updatedAt, fmt)} />
            )}
            {document.originalFilename && document.originalFilename !== document.name && (
              <Row label={t('details.original_name')} value={document.originalFilename} />
            )}
            <Row
              label={t('details.status')}
              value={[
                document.isLocked ? t('details.locked') : null,
                document.isFavorite ? t('details.favorite') : null,
              ]
                .filter(Boolean)
                .join(' · ') || t('details.none')}
            />
            {document.fileHash && (
              <Row
                label={t('details.hash')}
                value={`${document.fileHash.slice(0, 16)}…`}
              />
            )}
          </dl>
        )}
      </IonContent>
    </IonModal>
  );
}
