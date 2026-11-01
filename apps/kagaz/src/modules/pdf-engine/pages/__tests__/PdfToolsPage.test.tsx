import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { PdfToolsPage } from '../PdfToolsPage';

vi.mock('@/modules/document-vault/hooks/useDocuments', () => ({
  useDocuments: () => ({ documents: [], isLoading: false }),
}));

vi.mock('../../hooks/usePdfEngine', () => ({
  usePdfEngine: () => ({
    state: { busy: false, percent: 0, message: '', saving: false, error: null, errorCode: null },
    reset: vi.fn(),
    mergePdfs: vi.fn(),
    splitPdf: vi.fn(),
    compressPdf: vi.fn(),
    imagesToPdf: vi.fn(),
    pdfToImages: vi.fn(),
    encryptPdf: vi.fn(),
    decryptPdf: vi.fn(),
    loadFormFields: vi.fn(() => Promise.resolve([])),
    fillForm: vi.fn(),
  }),
}));

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

// Same fix as PdfExtractPagesSheet.test.tsx's own doc comment: IonModal's
// present()/dismiss() promise chain is a separate, unobserved chain from
// the DOM state cleanup() tears down — without a real macrotask tick after
// cleanup, a modal opened by an earlier test ("opens the operation sheet")
// can still be mid-teardown when the next test's render() starts, leaking
// its content into that test's queries.
afterEach(async () => {
  cleanup();
  await new Promise((resolve) => setTimeout(resolve, 50));
});

describe('PdfToolsPage', () => {
  it('renders a card for every PDF operation', () => {
    render(<PdfToolsPage />);
    for (const label of [
      'Merge PDFs',
      'Split PDF',
      'Compress PDF',
      'PDF → Images',
      'Images → PDF',
      'Password protect',
      'Remove password',
      'Fill form',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('opens the operation sheet when a card is tapped', async () => {
    render(<PdfToolsPage />);
    expect(
      document
        .querySelector('[data-agent-id="pdf-tools.op-sheet"]')
        ?.getAttribute('data-agent-state')
    ).toBe('closed');

    await userEvent.click(screen.getByText('Merge PDFs'));

    expect(
      document
        .querySelector('[data-agent-id="pdf-tools.op-sheet"]')
        ?.getAttribute('data-agent-state')
    ).toBe('open');
  });

  describe('search + category filters (UX pass 2026-07-24)', () => {
    // Scoped to this render's own container, not the whole document: a
    // prior test's IonModal-based PdfOpSheet can leave overlay DOM behind
    // across RTL's cleanup() (a known Ionic-overlay/RTL interaction this
    // codebase has hit before) — global screen queries risk matching stale
    // text from that leftover overlay instead of this render's own grid.
    it('filters the grid by search text, matching name or description', async () => {
      const { container } = render(<PdfToolsPage />);
      const search = within(container).getByLabelText('Search tools');
      await userEvent.type(search, 'password');

      expect(within(container).getByText('Password protect')).toBeInTheDocument();
      expect(within(container).getByText('Remove password')).toBeInTheDocument();
      expect(within(container).queryByText('Merge PDFs')).not.toBeInTheDocument();
    });

    it('shows a no-results message for a query matching nothing', async () => {
      const { container } = render(<PdfToolsPage />);
      const search = within(container).getByLabelText('Search tools');
      await userEvent.type(search, 'zzzznotarealtool');

      expect(
        within(container).getByText('No tools match "zzzznotarealtool"')
      ).toBeInTheDocument();
      expect(within(container).queryByText('Merge PDFs')).not.toBeInTheDocument();
    });

    it('filters the grid by category', async () => {
      const { container } = render(<PdfToolsPage />);
      await userEvent.click(
        within(container).getByText('Image tools')
      );

      expect(within(container).getByText('PDF → Images')).toBeInTheDocument();
      expect(within(container).getByText('Images → PDF')).toBeInTheDocument();
      expect(within(container).queryByText('Merge PDFs')).not.toBeInTheDocument();
    });

    it('combines search and category filters', async () => {
      const { container } = render(<PdfToolsPage />);
      await userEvent.click(within(container).getByText('Other tools'));
      const search = within(container).getByLabelText('Search tools');
      await userEvent.type(search, 'word');

      expect(within(container).getByText('PDF → Word')).toBeInTheDocument();
      expect(within(container).queryByText('PDF → Excel')).not.toBeInTheDocument();
    });
  });
});
