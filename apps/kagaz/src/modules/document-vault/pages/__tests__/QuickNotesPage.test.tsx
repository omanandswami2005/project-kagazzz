import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { copyToClipboard } from '@/core/clipboard';
import type { QuickReferenceEntry } from '@/infrastructure/database/types';
import { useQuickReference } from '../../hooks/useQuickReference';
import { QuickNotesPage } from '../QuickNotesPage';

vi.mock('../../hooks/useQuickReference', () => ({ useQuickReference: vi.fn() }));
vi.mock('@/core/clipboard', () => ({ copyToClipboard: vi.fn() }));

const useQuickReferenceMock = vi.mocked(useQuickReference);
const copyToClipboardMock = vi.mocked(copyToClipboard);

const entryA: QuickReferenceEntry = {
  id: 'note-1',
  label: 'Wi-Fi password',
  value: 'hunter2',
  isSecure: false,
  createdAt: '2026-07-24T00:00:00.000Z',
  updatedAt: '2026-07-24T00:00:00.000Z',
};
const entryB: QuickReferenceEntry = {
  id: 'note-2',
  label: 'Locker combo',
  value: '4-8-15',
  isSecure: false,
  createdAt: '2026-07-24T00:00:00.000Z',
  updatedAt: '2026-07-24T00:00:00.000Z',
};

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  copyToClipboardMock.mockResolvedValue(true);
  useQuickReferenceMock.mockReturnValue({
    entries: [entryA, entryB],
    tagsByEntry: new Map(),
    isLoading: false,
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    deleteEntry: vi.fn().mockResolvedValue(undefined),
    assignTag: vi.fn(),
    removeTag: vi.fn(),
  });
});

describe('QuickNotesPage (UX pass 2026-07-24)', () => {
  it('tapping a row copies its value instead of opening edit', async () => {
    render(<QuickNotesPage />);
    await userEvent.click(screen.getByText('Wi-Fi password'));
    expect(copyToClipboardMock).toHaveBeenCalledWith('hunter2', expect.anything());
    // Edit sheet never opened — no label/value inputs rendered.
    expect(screen.queryByDisplayValue('hunter2')).not.toBeInTheDocument();
  });

  it('edit is still reachable from the "more" menu', async () => {
    render(<QuickNotesPage />);
    await userEvent.click(
      document.querySelector('[data-agent-id="vault.quick-notes.item-note-1.more"]') as Element
    );
    const menu = document.querySelector(
      '[data-agent-id="vault.quick-notes.item-menu"]'
    ) as HTMLElement;
    expect(within(menu).getByText('Edit')).toBeInTheDocument();
  });

  describe('long-press to select', () => {
    it('long-press enters selection mode, second-row tap toggles it, and bulk-copy joins both values', async () => {
      render(<QuickNotesPage />);
      const rowA = document.querySelector(
        '[data-agent-id="vault.quick-notes.item-note-1"]'
      ) as Element;
      fireEvent.pointerDown(rowA, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 550));
      });
      fireEvent.pointerUp(rowA, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });

      expect(screen.getByText('1 selected')).toBeInTheDocument();

      // Tapping the second row while in selection mode toggles it (not copy).
      const rowB = document.querySelector(
        '[data-agent-id="vault.quick-notes.item-note-2"]'
      ) as Element;
      fireEvent.click(rowB);
      expect(screen.getByText('2 selected')).toBeInTheDocument();
      expect(copyToClipboardMock).not.toHaveBeenCalled();

      await userEvent.click(
        document.querySelector('[data-agent-id="vault.quick-notes.selection-copy"]') as Element
      );
      expect(copyToClipboardMock).toHaveBeenCalledWith(
        'Wi-Fi password: hunter2\nLocker combo: 4-8-15',
        expect.anything()
      );
    }, 10000);
  });
});
