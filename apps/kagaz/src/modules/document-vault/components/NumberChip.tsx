/**
 * A detected number in the viewer (F-83): tap copies it; press and hold
 * hands it to Quick Reference's Add sheet (audit VW-9). A recognised PAN /
 * Aadhaar gets its label pre-filled and Aadhaar is masked by default there.
 */
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@kagaz/ui';
import { useLongPress } from '@/core/gestures';

/** Props for {@link NumberChip}. */
export interface NumberChipProps {
  value: string;
  onCopy: (value: string) => void;
  onSaveToQuickReference: (value: string) => void;
}

/** Tap to copy, hold to keep in Quick Reference. */
export function NumberChip({ value, onCopy, onSaveToQuickReference }: NumberChipProps): ReactNode {
  const { t } = useTranslation('documents');
  const longPress = useLongPress(() => onSaveToQuickReference(value));
  return (
    <button
      type="button"
      className="kg-viewer__number-chip"
      onClick={() => {
        if (longPress.consumeTrailingClick()) return;
        onCopy(value);
      }}
      aria-label={t('viewer.copy_number', { number: value })}
      data-agent-id="vault.viewer.copy-number"
      {...longPress.bind}
    >
      <span className="kg-viewer__number-chip-value">{value}</span>
      <Icon name="Copy" size={16} aria-hidden />
    </button>
  );
}
