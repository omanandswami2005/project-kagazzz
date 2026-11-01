import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { copyToClipboard } from '@/core/clipboard';
import type { QuickReferenceEntry } from '@/infrastructure/database/types';
import { useQuickReference } from '../../hooks/useQuickReference';
import { QuickNotesPage } from '../QuickNotesPage';

vi.mock('../../hooks/useQuickReference', () => ({ useQuickReference: vi.fn() }));
vi.mock('@/core/clipboard', () => ({ copyToClipboard: vi.fn() }));

// FAB quick-add (UX pass 2026-07-25): QuickNotesPage reads `?new=1` via
// react-router-dom's useLocation/useHistory. Mocked wholesale (as
// DocumentViewerPage.test.tsx does for react-router-dom) rather than
// wrapped in a real Router, since these two hooks are the only thing the
// page needs from it.
let mockSearch = '';
const historyReplaceMock = vi.fn();
vi.mock('react-router-dom', () => ({
  useLocation: () => ({ search: mockSearch }),
  useHistory: () => ({ replace: historyReplaceMock }),
}));

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

// Same fix as PdfToolsPage.test.tsx / PdfExtractPagesSheet.test.tsx: IonModal's
// present()/dismiss() promise chain is a separate, unobserved chain from the
// DOM state cleanup() tears down. Without a real macrotask tick after
// cleanup, a modal left open at test end (e.g. the ?new=1 composer test)
// unmounts mid-teardown, and its overlay-controller callback later fires
// against a component that's already gone — an unhandled "framework
// delegate is missing" rejection that surfaces after the offending test.
afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 50));
});

beforeEach(() => {
  mockSearch = '';
  historyReplaceMock.mockClear();
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

  // FAB quick-add (UX pass 2026-07-25): VaultHomePage's UploadFAB Quick Note
  // item navigates to `/quick-notes?new=1` to skip the list and land right
  // in the composer.
  it('opens the add-note composer on mount when the URL carries ?new=1', async () => {
    mockSearch = '?new=1';
    render(<QuickNotesPage />);
    // Awaited (not a synchronous assertion): IonModal's present() is a real
    // custom-element lifecycle that needs a tick to register its overlay
    // delegate — asserting synchronously right after render() can end the
    // test, and trigger afterEach's cleanup(), before that registration
    // finishes, which is what caused the "framework delegate is missing"
    // unhandled rejection this test used to leave behind.
    await waitFor(() =>
      expect(
        document.querySelector('[data-agent-id="vault.quick-notes.edit-sheet"]')
      ).toHaveAttribute('data-agent-state', 'open')
    );
    expect(historyReplaceMock).toHaveBeenCalledWith('/quick-notes');
  });

  it('does not open the composer without the ?new=1 param', () => {
    render(<QuickNotesPage />);
    expect(
      document.querySelector('[data-agent-id="vault.quick-notes.edit-sheet"]')
    ).toHaveAttribute('data-agent-state', 'closed');
    expect(historyReplaceMock).not.toHaveBeenCalled();
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
