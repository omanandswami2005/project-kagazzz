/**
 * "Attach documents" sheet for the chat: pick any number of vault documents,
 * or upload new ones first. Reuses the PDF Tools document picker so the two
 * selection UIs behave the same.
 */
import { IonModal } from '@ionic/react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon } from '@kagaz/ui';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { PdfDocPicker } from '@/modules/pdf-engine/components/PdfDocPicker';

export interface AttachSheetProps {
  isOpen: boolean;
  documents: DocumentEntity[];
  lockedCount: number;
  onDismiss: () => void;
  onAttach: (documents: DocumentEntity[]) => void;
  onUploadNew: () => void;
}

export function AttachSheet({
  isOpen,
  documents,
  lockedCount,
  onDismiss,
  onAttach,
  onUploadNew,
}: AttachSheetProps): ReactNode {
  const { t } = useTranslation('ai-assistant');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const attach = (): void => {
    onAttach(documents.filter((d) => selectedIds.includes(d.id)));
    setSelectedIds([]);
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={() => {
        setSelectedIds([]);
        onDismiss();
      }}
      initialBreakpoint={0.75}
      breakpoints={[0, 0.75, 1]}
      data-agent-id="ai.chat.attach-sheet"
    >
      <div className="kg-chat-attach">
        <h2 className="kg-chat-attach__title">{t('attach.title')}</h2>
        <Button variant="secondary" size="sm" onClick={onUploadNew} agentId="ai.chat.attach-upload">
          <Icon name="Upload" size={16} aria-hidden /> {t('attach.upload_new')}
        </Button>
        <p className="kg-chat-attach__hint">{t('attach.pick_hint')}</p>
        <PdfDocPicker
          documents={documents}
          multi
          selectedIds={selectedIds}
          onChange={setSelectedIds}
          emptyText={t('attach.empty')}
          idPrefix="ai.chat.attach-picker"
        />
        {lockedCount > 0 && (
          <p className="kg-chat-attach__hint" data-agent-id="ai.chat.attach-locked-hint">
            {t('attach.locked_hint', { count: lockedCount })}
          </p>
        )}
        <Button
          variant="primary"
          disabled={selectedIds.length === 0}
          onClick={attach}
          agentId="ai.chat.attach-confirm"
        >
          {t('attach.confirm', { count: selectedIds.length })}
        </Button>
      </div>
    </IonModal>
  );
}
