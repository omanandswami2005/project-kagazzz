import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { PdfToolsPage } from '../PdfToolsPage';

vi.mock('@/modules/document-vault/hooks/useDocuments', () => ({
  useDocuments: () => ({ documents: [], isLoading: false }),
}));

vi.mock('../../hooks/usePdfEngine', () => ({
  usePdfEngine: () => ({
    state: { busy: false, percent: 0, message: '', error: null, errorCode: null },
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
});
