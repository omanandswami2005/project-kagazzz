import { IonContent, IonPage } from '@ionic/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import type { QuickReferenceEntry } from '@/infrastructure/database/types';
import { QuickNoteRow } from '../QuickNoteRow';
import { QuickReferenceEditSheet } from '../QuickReferenceEditSheet';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

const note = (value: string): QuickReferenceEntry =>
  ({ id: 'n1', label: 'My PAN', value }) as QuickReferenceEntry;
const q = (id: string): Element | null => document.querySelector(`[data-agent-id="${id}"]`);

describe('Quick Notes → Quick Reference (QN-2)', () => {
  it('offers Move for an ID-looking note, not for plain text', async () => {
    const onMove = vi.fn();
    const props = { selectionMode: false, selected: false, onCopy: vi.fn(), onToggleSelect: vi.fn(), onLongPress: vi.fn(), onMore: vi.fn(), onMoveToQuickReference: onMove };
    const { rerender } = render(<ul><QuickNoteRow entry={note('abcpe1234f')} {...props} /></ul>);
    await userEvent.click(q('vault.quick-notes.item-n1.move') as Element);
    expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1' }), { kind: 'pan', value: 'ABCPE1234F' });
    rerender(<ul><QuickNoteRow entry={note('wifi password hint')} {...props} /></ul>);
    expect(q('vault.quick-notes.item-n1.move')).toBeNull();
  });
});

describe('Quick Reference Add sheet with an Aadhaar draft (QR-2)', () => {
  it('saves only the last 4 digits by default', async () => {
    const onSave = vi.fn(() => Promise.resolve());
    render(
      <IonPage>
        <IonContent>
          <QuickReferenceEditSheet
            entry={null}
            draft={{ label: 'Aadhaar No', value: '2341 2341 2346', kind: 'aadhaar' }}
            onClose={() => undefined}
            onSave={onSave}
          />
        </IonContent>
      </IonPage>
    );
    expect(await screen.findByText(/Keep only the last 4 digits/)).toBeInTheDocument();
    await userEvent.click(q('vault.quick-reference.save') as Element);
    expect(onSave).toHaveBeenCalledWith('Aadhaar No', 'XXXX XXXX 2346', undefined);
  });
});
