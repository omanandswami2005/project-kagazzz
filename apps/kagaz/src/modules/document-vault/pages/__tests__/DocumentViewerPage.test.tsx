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
    markAccessed: ReturnType<typeof vi.fn>;
    authorizeView: ReturnType<typeof vi.fn>;
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
    markAccessed: vi.fn(),
    authorizeView: vi.fn(),
  })
);

const goBack = vi.fn();

vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'd1' }) }));
// [SEC] bug-audit hardening: a declined authorization now calls
// router.goBack() directly from this page — useIonRouter() throws
// "An Ionic Router is required" without a real IonReactRouter ancestor,
// which this lightweight page test doesn't provide (same reasoning as
// every other hook mocked below). Keep every other @ionic/react export real.
vi.mock('@ionic/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ionic/react')>();
  return { ...actual, useIonRouter: () => ({ goBack, push: vi.fn() }) };
});
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
// DocumentDetailsSheet (F-67) reads the locale via useLocale.
vi.mock('@/core/i18n', () => ({ useLocale: () => ({ locale: 'en' }) }));
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
  useVaultMutations: () => ({ softDelete: state.softDelete, markAccessed: state.markAccessed }),
}));
// [SEC] bug-audit hardening: the viewer now gates on its own authorizeView
// call — default it to an immediate "allowed" so every existing test's
// synchronous-looking assertions keep working; the gate itself is covered
// by the dedicated "lock gate" describe block below.
vi.mock('../../hooks/useDocLock', () => ({
  useDocLock: () => ({ authorizeView: state.authorizeView }),
}));

import { DocumentViewerPage } from '../DocumentViewerPage';

const doc = (over: Partial<DocumentEntity> = {}): DocumentEntity =>
  ({ id: 'd1', name: 'PAN Card', fileType: 'image/jpeg', ...over }) as DocumentEntity;

const q = (id: string): HTMLElement | null => document.querySelector(`[data-agent-id="${id}"]`);

/** Renders and flushes the (now-async) authorization gate's microtask. */
async function renderAuthorized(): Promise<void> {
  render(<DocumentViewerPage />);
  await act(async () => {
    await Promise.resolve();
  });
}

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
  state.authorizeView.mockResolvedValue(true);
});
afterEach(cleanup);

describe('DocumentViewerPage (UX-6)', () => {
  it('renders the document pages', async () => {
    await renderAuthorized();
    expect(q('vault.viewer.pages')?.querySelectorAll('img').length).toBe(1);
  });

  it('shows a spinner while loading', () => {
    state.fileLoading = true;
    render(<DocumentViewerPage />);
    expect(document.querySelector('[data-agent-state="loading"]')).not.toBeNull();
  });

  it('shows the extracted text + copy when OCR text exists', async () => {
    state.document = doc({ ocrText: 'AADHAAR 1234' });
    await renderAuthorized();
    expect(screen.getByText('AADHAAR 1234')).toBeInTheDocument();
    expect(q('vault.viewer.copy-text')).not.toBeNull();
    expect(q('vault.viewer.extract-text')).toBeNull();
  });

  it('offers a copyable chip for each detected number (F-83)', async () => {
    state.document = doc({ ocrText: 'UID: 1234 5678 9012 issued 2024' });
    await renderAuthorized();
    expect(q('vault.viewer.numbers-panel')).not.toBeNull();
    const chips = document.querySelectorAll('[data-agent-id="vault.viewer.copy-number"]');
    expect(chips).toHaveLength(2); // "1234 5678 9012" and "2024"
    expect(chips[0]?.textContent).toContain('1234 5678 9012');
  });

  it('hides the numbers panel when the extracted text has no numbers', async () => {
    state.document = doc({ ocrText: 'Government of India' });
    await renderAuthorized();
    expect(q('vault.viewer.numbers-panel')).toBeNull();
  });

  it('offers Extract text for an image with no text yet', async () => {
    state.document = doc({ ocrText: undefined });
    await renderAuthorized();
    expect(q('vault.viewer.extract-text')).not.toBeNull();
    await act(async () => {
      fireEvent.click(q('vault.viewer.extract-text')!);
    });
    expect(state.extractText).toHaveBeenCalled();
  });

  it('offers Extract text for a PDF with no stored text (UX-13)', async () => {
    state.canOcr = true; // canExtractText → true for a PDF (text-layer path)
    state.document = doc({ fileType: 'application/pdf', ocrText: undefined });
    await renderAuthorized();
    expect(q('vault.viewer.extract-text')).not.toBeNull();
    await act(async () => {
      fireEvent.click(q('vault.viewer.extract-text')!);
    });
    expect(state.extractText).toHaveBeenCalled();
  });

  it('shows a no-text hint for docs whose text cannot be extracted', async () => {
    state.canOcr = false;
    state.document = doc({ fileType: 'text/plain', ocrText: undefined });
    await renderAuthorized();
    expect(q('vault.viewer.extract-text')).toBeNull();
    expect(screen.getByText('viewer.no_text')).toBeInTheDocument();
  });

  it('renders an error state when the file fails to render', async () => {
    state.error = true;
    await renderAuthorized();
    expect(q('vault.viewer.error')).not.toBeNull();
  });
});

describe('DocumentViewerPage lock gate (bug-audit hardening)', () => {
  it('shows the loading state (not the content) while authorization is pending', () => {
    state.authorizeView.mockReturnValue(new Promise(() => undefined)); // never resolves
    render(<DocumentViewerPage />);
    expect(document.querySelector('[data-agent-state="loading"]')).not.toBeNull();
    expect(q('vault.viewer.pages')).toBeNull();
  });

  it('hides the header "more" menu trigger until authorized', () => {
    state.authorizeView.mockReturnValue(new Promise(() => undefined));
    render(<DocumentViewerPage />);
    expect(q('vault.viewer.more')).toBeNull();
  });

  it('shows content and the "more" trigger once authorization succeeds', async () => {
    await renderAuthorized();
    expect(q('vault.viewer.pages')).toBeInTheDocument();
    expect(q('vault.viewer.more')).not.toBeNull();
  });

  it('stamps markAccessed only after a successful authorization', async () => {
    await renderAuthorized();
    expect(state.markAccessed).toHaveBeenCalledWith(state.document);
  });

  it('never stamps markAccessed when authorization is declined, and navigates back', async () => {
    state.authorizeView.mockResolvedValue(false);
    await renderAuthorized();
    expect(state.markAccessed).not.toHaveBeenCalled();
    expect(goBack).toHaveBeenCalledOnce();
  });
});
