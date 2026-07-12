import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const state = vi.hoisted(
  (): {
    document: DocumentEntity | null;
    loading: boolean;
    pages: string[];
    fileLoading: boolean;
    error: boolean;
    ocrText: string;
    canOcr: boolean;
    extractText: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
  } => ({
    document: null,
    loading: false,
    pages: [],
    fileLoading: false,
    error: false,
    ocrText: '',
    canOcr: true,
    extractText: vi.fn(),
    softDelete: vi.fn(),
  })
);

vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'd1' }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('../../hooks/useDocument', () => ({
  useDocument: () => ({ document: state.document, loading: state.loading }),
}));
vi.mock('../../hooks/useDocumentFile', () => ({
  useDocumentFile: () => ({ pages: state.pages, loading: state.fileLoading, error: state.error }),
}));
vi.mock('../../hooks/useDocumentOcr', () => ({
  canExtractText: () => state.canOcr,
  useDocumentOcr: () => ({ extractText: state.extractText, runningId: null }),
}));
vi.mock('../../hooks/useVaultMutations', () => ({
  useVaultMutations: () => ({ softDelete: state.softDelete }),
}));

import { DocumentViewerPage } from '../DocumentViewerPage';

const doc = (over: Partial<DocumentEntity> = {}): DocumentEntity =>
  ({ id: 'd1', name: 'PAN Card', fileType: 'image/jpeg', ...over }) as DocumentEntity;

const q = (id: string): HTMLElement | null => document.querySelector(`[data-agent-id="${id}"]`);

beforeEach(() => {
  vi.clearAllMocks();
  state.extractText.mockResolvedValue('AADHAAR 1234');
  state.document = doc();
  state.loading = false;
  state.pages = ['blob:page-1'];
  state.fileLoading = false;
  state.error = false;
  state.ocrText = '';
  state.canOcr = true;
  state.document = doc({ ocrText: state.ocrText });
});
afterEach(cleanup);

describe('DocumentViewerPage (UX-6)', () => {
  it('renders the document pages', () => {
    render(<DocumentViewerPage />);
    expect(q('vault.viewer.pages')?.querySelectorAll('img').length).toBe(1);
  });

  it('shows a spinner while loading', () => {
    state.fileLoading = true;
    render(<DocumentViewerPage />);
    expect(document.querySelector('[data-agent-state="loading"]')).not.toBeNull();
  });

  it('shows the extracted text + copy when OCR text exists', () => {
    state.document = doc({ ocrText: 'AADHAAR 1234' });
    render(<DocumentViewerPage />);
    expect(screen.getByText('AADHAAR 1234')).toBeInTheDocument();
    expect(q('vault.viewer.copy-text')).not.toBeNull();
    expect(q('vault.viewer.extract-text')).toBeNull();
  });

  it('offers Extract text for an image with no text yet', async () => {
    state.document = doc({ ocrText: undefined });
    render(<DocumentViewerPage />);
    expect(q('vault.viewer.extract-text')).not.toBeNull();
    await act(async () => {
      fireEvent.click(q('vault.viewer.extract-text')!);
    });
    expect(state.extractText).toHaveBeenCalled();
  });

  it('offers Extract text for a PDF with no stored text (UX-13)', async () => {
    state.canOcr = true; // canExtractText → true for a PDF (text-layer path)
    state.document = doc({ fileType: 'application/pdf', ocrText: undefined });
    render(<DocumentViewerPage />);
    expect(q('vault.viewer.extract-text')).not.toBeNull();
    await act(async () => {
      fireEvent.click(q('vault.viewer.extract-text')!);
    });
    expect(state.extractText).toHaveBeenCalled();
  });

  it('shows a no-text hint for docs whose text cannot be extracted', () => {
    state.canOcr = false;
    state.document = doc({ fileType: 'text/plain', ocrText: undefined });
    render(<DocumentViewerPage />);
    expect(q('vault.viewer.extract-text')).toBeNull();
    expect(screen.getByText('viewer.no_text')).toBeInTheDocument();
  });

  it('renders an error state when the file fails to render', () => {
    state.error = true;
    render(<DocumentViewerPage />);
    expect(q('vault.viewer.error')).not.toBeNull();
  });
});
