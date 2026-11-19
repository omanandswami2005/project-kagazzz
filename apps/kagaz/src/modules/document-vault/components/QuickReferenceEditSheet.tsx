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
import { Button, Checkbox, Icon, Input } from '@kagaz/ui';
import { maskAadhaar } from '@/core/id-numbers';
import type { QuickReferenceDraft } from '../store/quick-reference-draft';
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
  /** Pre-fills create mode (a value found in a document or note). */
  draft?: QuickReferenceDraft | null;
}

/** The Quick Reference create/edit sheet. */
export function QuickReferenceEditSheet({
  entry,
  onClose,
  onSave,
  draft,
}: QuickReferenceEditSheetProps): ReactNode {
  const { t } = useTranslation('documents');
  const [label, setLabel] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  // [COMPLIANCE — check before publication] Aadhaar is kept masked by default
  // (UIDAI masked-Aadhaar guidance); the user may opt to keep it in full.
  const [maskId, setMaskId] = useState(true);
  const isAadhaarDraft = !entry && draft?.kind === 'aadhaar';
  const isOpen = entry !== undefined;

  // Reset/prefill each time the sheet opens for a new create or a different
  // entry. (Same IonModal-close-animation trade-off as ResizeCompressSheet
  // and PdfOpSheet — a `key` remount would skip it.)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setLabel(entry?.label ?? (entry === null ? (draft?.label ?? '') : ''));
    setValue(entry?.value ?? (entry === null ? (draft?.value ?? '') : ''));
    setMaskId(true);
  }, [entry, draft]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const canSave = label.trim().length > 0 && value.trim().length > 0;

  const handleSave = (): void => {
    if (!canSave) {
      return;
    }
    setSaving(true);
    const saved = isAadhaarDraft && maskId ? maskAadhaar(value) : value;
    void onSave(label, saved, entry?.id).finally(() => setSaving(false));
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
              value={isAadhaarDraft && maskId ? maskAadhaar(value) : value}
              onChange={setValue}
              disabled={isAadhaarDraft && maskId}
              agentId="vault.quick-reference.value-input"
            />
            {isAadhaarDraft && (
              <Checkbox
                checked={maskId}
                onChange={setMaskId}
                label={t('quick_reference.mask_aadhaar')}
                agentId="vault.quick-reference.mask-aadhaar"
              />
            )}
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
