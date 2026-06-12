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
} from '@ionic/react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocale } from '@/core/i18n';
import { StorageDonut } from '../components/StorageDonut';
import { useStorageStats } from '../hooks/useStorageStats';
import './vault.css';

/** Usage-overview screen for the vault. */
export function StoragePage(): ReactNode {
  const { t } = useTranslation('documents');
  const { formatFileSize } = useLocale();
  const { stats } = useStorageStats();

  return (
    <IonPage data-agent-id="vault.storage">
      <IonHeader>
        <IonToolbar>
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
                <section data-agent-id="vault.storage.by-type">
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
                    groups: stats.duplicateGroups,
                    size: formatFileSize(stats.reclaimableBytes),
                  })}
                </section>
              )}

              <section data-agent-id="vault.storage.largest">
                <h2 className="kg-storage__heading">{t('storage.largest')}</h2>
                <ul className="kg-storage__list">
                  {stats.largest.map((doc) => (
                    <li key={doc.id} className="kg-storage__largest-row">
                      <span className="kg-storage__largest-name">{doc.name}</span>
                      <span className="kg-storage__row-size">
                        {formatFileSize(doc.fileSize)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
}

export default StoragePage;
