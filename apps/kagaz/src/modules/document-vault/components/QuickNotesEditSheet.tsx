/**
 * Quick Notes create/edit form (UX pass, 2026-07-23 — the faster, gate-free
 * sibling of Quick Reference's edit sheet, F-84). Same shape, no template
 * chips: Quick Reference's templates are all identity-document labels
 * (Aadhaar/PAN/mobile/...), which would actively mislead a user into
 * thinking this un-gated board is an appropriate place for them.
 */
import {
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonModal,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Input } from '@kagaz/ui';
import type { QuickReferenceEntry } from '@/infrastructure/database/types';

/** Props for {@link QuickNotesEditSheet}. */
export interface QuickNotesEditSheetProps {
  /** `undefined` = closed, `null` = create mode, an entry = edit mode. */
  entry: QuickReferenceEntry | null | undefined;
  onClose: () => void;
  onSave: (label: string, value: string, editingId?: string) => Promise<void>;
}

/** The Quick Notes create/edit sheet. */
export function QuickNotesEditSheet({
  entry,
  onClose,
  onSave,
}: QuickNotesEditSheetProps): ReactNode {
  const { t } = useTranslation('documents');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const isOpen = entry !== undefined;

  // Same IonModal-close-animation trade-off as QuickReferenceEditSheet/
  // ResizeCompressSheet/PdfOpSheet — a `key` remount would skip it.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLabel(entry?.label ?? '');
    setValue(entry?.value ?? '');
  }, [entry]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canSave = label.trim().length > 0 && value.trim().length > 0;

  const handleSave = (): void => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    void onSave(label, value, entry?.id).finally(() => setSaving(false));
  };

  return (
    <IonModal
      isOpen={isOpen}
      onDidDismiss={onClose}
      data-agent-id="vault.quick-notes.edit-sheet"
      data-agent-state={isOpen ? 'open' : 'closed'}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            {entry ? t('quick_notes.edit_title') : t('quick_notes.add_title')}
          </IonTitle>
          <IonButtons slot="end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              agentId="vault.quick-notes.edit-sheet.close"
            >
              <Icon name="X" size={24} aria-label="Close" />
            </Button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="kg-quickref-edit">
          <div className="kg-quickref-edit__fields">
            <Input
              label={t('quick_notes.label_field')}
              value={label}
              onChange={setLabel}
              agentId="vault.quick-notes.label-input"
            />
            <Input
              label={t('quick_notes.value_field')}
              value={value}
              onChange={setValue}
              agentId="vault.quick-notes.value-input"
            />
          </div>
        </div>
      </IonContent>

      <IonFooter>
        <div className="kg-quickref-edit__footer">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            disabled={saving || !canSave}
            onClick={handleSave}
            agentId="vault.quick-notes.save"
          >
            {t('quick_notes.save')}
          </Button>
        </div>
      </IonFooter>
    </IonModal>
  );
}
