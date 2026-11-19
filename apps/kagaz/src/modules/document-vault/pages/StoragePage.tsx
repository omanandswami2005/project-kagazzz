/**
 * Storage page (02-document-vault-module.md §Storage Management):
 * total usage, breakdown by file type, the largest documents, and
 * duplicate-reclaim hints (F-26). Read-only.
 */
import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonRouter,
} from '@ionic/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '@/core/i18n';
import { useAi } from '@/app/providers/AIProvider';
import { Button, Icon } from '@kagaz/ui';
import { DocumentThumb } from '@/core/components/DocumentThumb';
import { pdfToolRoute } from '@/core/constants/routes';
import { StorageDonut } from '../components/StorageDonut';
import { isPdf } from '../hooks/useDocumentFile';
import { useStorageStats } from '../hooks/useStorageStats';
import './vault.css';
import { MenuButton } from '@/app/shell/MenuButton';

/** Usage-overview screen for the vault. */
export function StoragePage(): ReactNode {
  const { t } = useTranslation('documents');
  const { formatFileSize } = useLocale();
  const { stats } = useStorageStats();
  const ai = useAi();
  const router = useIonRouter();

  return (
    <IonPage data-agent-id="vault.storage">
      <IonHeader>
        <IonToolbar>
          <MenuButton />
          <IonTitle>{t('storage.title')}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <main className="kg-storage" data-agent-id="vault.storage.content">
          {stats === null ? (
            <p data-agent-id="vault.storage.loading">{t('storage.loading')}</p>
          ) : (
            <>
              {stats.byType.length > 0 ? (
                <section className="kg-storage__card" data-agent-id="vault.storage.by-type">
                  <h2 className="kg-storage__heading">{t('storage.by_type')}</h2>
                  <StorageDonut
                    segments={stats.byType.map((row) => ({
                      label: row.fileType.toUpperCase(),
                      sizeLabel: formatFileSize(row.bytes),
                      fraction: row.fraction,
                    }))}
                    centerValue={formatFileSize(stats.totalBytes)}
                    centerLabel={t('storage.used', {
                      count: stats.documentCount,
                    })}
                    ariaLabel={t('storage.by_type')}
                  />
                </section>
              ) : (
                <section
                  className="kg-storage__total"
                  data-agent-id="vault.storage.total"
                >
                  <span className="kg-storage__total-value">
                    {formatFileSize(stats.totalBytes)}
                  </span>
                  <span className="kg-storage__total-label">
                    {t('storage.used', { count: stats.documentCount })}
                  </span>
                </section>
              )}

              {stats.duplicateGroups > 0 && (
                <section
                  className="kg-storage__dupes"
                  data-agent-id="vault.storage.duplicates"
                >
                  {t('storage.duplicates', {
                    count: stats.duplicateGroups,
                    size: formatFileSize(stats.reclaimableBytes),
                  })}
                </section>
              )}

              {/* ST-3/ST-5: each large document opens on tap; PDFs offer
                  Compress right where the space is being spent. */}
              <section className="kg-storage__card" data-agent-id="vault.storage.largest">
                <h2 className="kg-storage__heading">{t('storage.largest')}</h2>
                <ul className="kg-storage__list">
                  {stats.largest.map((doc) => (
                    <li key={doc.id} className="kg-storage__largest-row">
                      <button
                        type="button"
                        className="kg-storage__largest-open"
                        onClick={() => router.push(`/doc/${doc.id}`, 'forward', 'push')}
                        data-agent-id={`vault.storage.largest-${doc.id}`}
                      >
                        <DocumentThumb document={doc} iconSize={20} className="kg-storage__thumb" />
                        <span className="kg-storage__largest-text">
                          <span className="kg-storage__largest-name">{doc.name}</span>
                          <span className="kg-storage__row-size">{formatFileSize(doc.fileSize)}</span>
                        </span>
                      </button>
                      {isPdf(doc.fileType) && !doc.isLocked && (
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Icon name="Shrink" size={20} />}
                          onClick={() => router.push(pdfToolRoute('compress', doc.id), 'forward', 'push')}
                          agentId={`vault.storage.largest-${doc.id}.compress`}
                        >
                          {t('viewer.compress')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>

              {ai.modelOnDisk && (
                <section
                  className="kg-storage__ai-model"
                  data-agent-id="vault.storage.ai-model"
                >
                  <span className="kg-storage__ai-model-info">
                    <span className="kg-storage__ai-model-label">{t('storage.ai_model')}</span>
                    <span className="kg-storage__row-size">
                      {t('storage.ai_model_size', { size: formatFileSize(ai.modelSizeBytes) })}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    agentId="vault.storage.ai-model.manage"
                    onClick={() => router.push('/ai-assistant', 'forward', 'push')}
                  >
                    {t('storage.ai_model_manage')}
                  </Button>
                </section>
              )}
            </>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
}

export default StoragePage;
