/**
 * "Free up space" (screen audit ST-5, next best action): everything that
 * frees storage, with its size — empty the Trash, compress the large PDFs
 * (sizes measured by a dry run, not guessed), and the on-device AI model.
 */
import { IonModal } from '@ionic/react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Icon, ListRow } from '@kagaz/ui';
import { useLocale } from '@/core/i18n';
import type { DocumentEntity } from '@/infrastructure/database/types';
import type { CompressionEstimates } from '../hooks/useCompressionEstimates';
import { useTrash } from '../hooks/useTrash';

/** Props for {@link FreeUpSpaceSheet}. */
export interface FreeUpSpaceSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** The largest unlocked PDFs. */
  pdfs: DocumentEntity[];
  estimates: CompressionEstimates;
  onCompress: (doc: DocumentEntity) => void;
  /** Size of the downloaded AI model, when there is one. */
  aiModelBytes?: number;
  onManageAi: () => void;
  /** Called after the Trash is emptied, so the page can refresh its totals. */
  onFreed: () => void;
}

/** Bottom sheet listing every way to free space, biggest wins first. */
export function FreeUpSpaceSheet({
  isOpen,
  onClose,
  pdfs,
  estimates,
  onCompress,
  aiModelBytes,
  onManageAi,
  onFreed,
}: FreeUpSpaceSheetProps): ReactNode {
  const { t } = useTranslation('documents');
  const { formatFileSize } = useLocale();
  const trash = useTrash();
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const trashBytes = trash.items.reduce((sum, doc) => sum + doc.fileSize, 0);
  const measured = pdfs.length > 0 && pdfs.every((d) => estimates.savings.has(d.id));
  const worthIt = pdfs.filter((d) => (estimates.savings.get(d.id) ?? 0) > 0);
  const total = worthIt.reduce((sum, d) => sum + (estimates.savings.get(d.id) ?? 0), 0);

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      className="kg-sheet-auto"
      initialBreakpoint={1}
      breakpoints={[0, 1]}
      data-agent-id="vault.storage.free-up"
      data-agent-state={isOpen ? 'expanded' : 'collapsed'}
      aria-label={t('storage.free_up')}
    >
      <div className="kg-free-up">
        <h2 className="kg-free-up__title">{t('storage.free_up')}</h2>

        {trash.items.length > 0 && (
          <ListRow
            icon="Trash2"
            title={t('trash.empty_trash_size', { size: formatFileSize(trashBytes) })}
            hint={t('storage.free_up_trash', { count: trash.items.length })}
            noChevron
            onClick={() => setConfirmEmpty(true)}
            agentId="vault.storage.free-up.empty-trash"
          />
        )}

        <section className="kg-free-up__section">
          <h3 className="kg-free-up__heading">{t('storage.free_up_compress')}</h3>
          {pdfs.length === 0 ? (
            <p className="kg-free-up__hint">{t('storage.free_up_no_pdfs')}</p>
          ) : !measured ? (
            <Button
              variant="secondary"
              fullWidth
              icon={<Icon name="Shrink" size={20} />}
              loading={estimates.checking > 0}
              onClick={() => void estimates.run(pdfs)}
              agentId="vault.storage.free-up.check"
            >
              {estimates.checking > 0
                ? t('storage.free_up_checking', { n: estimates.checking, total: pdfs.length })
                : t('storage.free_up_check', { count: pdfs.length })}
            </Button>
          ) : worthIt.length === 0 ? (
            <p className="kg-free-up__hint">{t('storage.free_up_already_small')}</p>
          ) : (
            <>
              <p className="kg-free-up__hint">{t('storage.free_up_total', { size: formatFileSize(total) })}</p>
              {worthIt.map((doc) => (
                <ListRow
                  key={doc.id}
                  icon="FileText"
                  title={doc.name}
                  hint={t('storage.save_about', { size: formatFileSize(estimates.savings.get(doc.id) ?? 0) })}
                  onClick={() => onCompress(doc)}
                  agentId={`vault.storage.free-up.compress-${doc.id}`}
                />
              ))}
            </>
          )}
        </section>

        {aiModelBytes !== undefined && aiModelBytes > 0 && (
          <ListRow
            icon="Cpu"
            title={t('storage.ai_model')}
            hint={t('storage.ai_model_size', { size: formatFileSize(aiModelBytes) })}
            onClick={onManageAi}
            agentId="vault.storage.free-up.ai-model"
          />
        )}
      </div>

      <Alert
        isOpen={confirmEmpty}
        header={t('trash.empty_confirm')}
        agentId="vault.storage.free-up.empty-confirm"
        onDidDismiss={() => setConfirmEmpty(false)}
        buttons={[
          { text: t('trash.cancel'), role: 'cancel' },
          {
            text: t('trash.empty_confirm_yes'),
            role: 'destructive',
            handler: (): void => {
              void trash.emptyTrash().then(onFreed);
            },
          },
        ]}
      />
    </IonModal>
  );
}
