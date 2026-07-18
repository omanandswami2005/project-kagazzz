/**
 * Quick Reference create/edit form (F-84,
 * 02-document-vault-module.md §Quick Reference). Template chips only
 * pre-fill the label text field — presentation-layer convenience, never a
 * schema/validation concept (see 10-security-architecture.md §3.6).
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

const TEMPLATE_KEYS = [
  'aadhaar',
  'pan',
  'mobile',
  'bank_account',
  'ifsc',
  'email',
  'voter_id',
  'driving_licence',
  'passport',
  'uan',
] as const;

/** Props for {@link QuickReferenceEditSheet}. */
export interface QuickReferenceEditSheetProps {
  /** `undefined` = closed, `null` = create mode, an entry = edit mode. */
  entry: QuickReferenceEntry | null | undefined;
  onClose: () => void;
  onSave: (label: string, value: string, editingId?: string) => Promise<void>;
}

/** The Quick Reference create/edit sheet. */
export function QuickReferenceEditSheet({
  entry,
  onClose,
  onSave,
}: QuickReferenceEditSheetProps): ReactNode {
  const { t } = useTranslation('documents');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const isOpen = entry !== undefined;

  // Reset/prefill each time the sheet opens for a new create or a different
  // entry. (Same IonModal-close-animation trade-off as ResizeCompressSheet
  // and PdfOpSheet — a `key` remount would skip it.)
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
      data-agent-id="vault.quick-reference.edit-sheet"
      data-agent-state={isOpen ? 'open' : 'closed'}
    >
      <IonHeader>
        <IonToolbar>
          <IonTitle>
            {entry ? t('quick_reference.edit_title') : t('quick_reference.add_title')}
          </IonTitle>
          <IonButtons slot="end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              agentId="vault.quick-reference.edit-sheet.close"
            >
              <Icon name="X" size={24} aria-label="Close" />
            </Button>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent>
        <div className="kg-quickref-edit">
          {!entry && (
            <div
              className="kg-quickref-edit__templates"
              role="group"
              aria-label={t('quick_reference.templates_label')}
            >
              {TEMPLATE_KEYS.map((key) => (
                <Button
                  key={key}
                  variant="secondary"
                  size="sm"
                  onClick={() => setLabel(t(`quick_reference.template_${key}`))}
                  agentId={`vault.quick-reference.template-${key}`}
                >
                  {t(`quick_reference.template_${key}`)}
                </Button>
              ))}
            </div>
          )}

          <div className="kg-quickref-edit__fields">
            <Input
              label={t('quick_reference.label_field')}
              value={label}
              onChange={setLabel}
              agentId="vault.quick-reference.label-input"
            />
            <Input
              label={t('quick_reference.value_field')}
              value={value}
              onChange={setValue}
              agentId="vault.quick-reference.value-input"
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
            agentId="vault.quick-reference.save"
          >
            {t('quick_reference.save')}
          </Button>
        </div>
      </IonFooter>
    </IonModal>
  );
}
