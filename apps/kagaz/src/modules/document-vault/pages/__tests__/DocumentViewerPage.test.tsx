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
    /** `?trashed=1` or `''` — read by the mocked `useLocation`. */
    search: string;
    extractText: ReturnType<typeof vi.fn>;
    softDelete: ReturnType<typeof vi.fn>;
    markAccessed: ReturnType<typeof vi.fn>;
    authorizeView: ReturnType<typeof vi.fn>;
    useDocument: ReturnType<typeof vi.fn<(id: string, options?: { trashed?: boolean }) => void>>;
  } => ({
    document: null,
    loading: false,
    pages: [],
    fileLoading: false,
    error: false,
    ocrText: '',
    canOcr: true,
    search: '',
    extractText: vi.fn(),
    softDelete: vi.fn(),
    markAccessed: vi.fn(),
    authorizeView: vi.fn(),
    useDocument: vi.fn(),
  })
);

const goBack = vi.fn();

vi.mock('react-router-dom', () => ({
  useParams: () => ({ id: 'd1' }),
  // F-57 preview: the page reads `?trashed=1` off this to decide whether to
  // load (and gate/render) the document as a Trash preview.
  useLocation: () => ({ search: state.search, pathname: '/doc/d1', hash: '', state: null }),
}));
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
  // Records the (id, options) it was called with so tests can assert the
  // `trashed` flag is correctly forwarded from the `?trashed=1` query param.
  useDocument: (id: string, options?: { trashed?: boolean }) => {
    state.useDocument(id, options);
    return { document: state.document, loading: state.loading };
  },
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
  state.search = '';
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

describe('DocumentViewerPage Trash preview (F-57 device-testing follow-up)', () => {
  it('loads via useDocument with trashed: true when the route has ?trashed=1', async () => {
    state.search = '?trashed=1';
    await renderAuthorized();
    expect(state.useDocument).toHaveBeenCalledWith('d1', { trashed: true });
  });

  it('loads live (trashed: false) with no query param', async () => {
    await renderAuthorized();
    expect(state.useDocument).toHaveBeenCalledWith('d1', { trashed: false });
  });

  it('shows the trashed-preview banner once authorized, not for a live document', async () => {
    state.search = '?trashed=1';
    await renderAuthorized();
    expect(q('vault.viewer.trashed-banner')).not.toBeNull();
  });

  it('shows no banner for a live (non-trashed) document', async () => {
    await renderAuthorized();
    expect(q('vault.viewer.trashed-banner')).toBeNull();
  });

  it('hides Delete from the menu for a trashed preview (Trash already owns restore/delete-forever)', async () => {
    state.search = '?trashed=1';
    await renderAuthorized();
    fireEvent.click(q('vault.viewer.more')!);
    expect(screen.queryByText('actions.delete')).toBeNull();
  });

  it('offers Delete from the menu for a live document', async () => {
    await renderAuthorized();
    fireEvent.click(q('vault.viewer.more')!);
    expect(screen.getByText('actions.delete')).toBeInTheDocument();
  });

  it('does not stamp markAccessed for a trashed preview even when authorized', async () => {
    state.search = '?trashed=1';
    await renderAuthorized();
    expect(state.authorizeView).toHaveBeenCalledWith(state.document);
    expect(state.markAccessed).not.toHaveBeenCalled();
  });

  // [SEC] CRITICAL: a document locked before being trashed must still gate
  // behind the same biometric prompt when previewed from Trash — the
  // `trashed` branch must never bypass authorizeView.
  it('[SEC] still requires authorization for a locked, trashed document, and blocks content when declined', async () => {
    state.search = '?trashed=1';
    state.document = doc({ isLocked: true, deletedAt: '2026-07-01T00:00:00.000Z' });
    state.authorizeView.mockResolvedValue(false);
    await renderAuthorized();
    expect(state.authorizeView).toHaveBeenCalledWith(state.document);
    expect(q('vault.viewer.pages')).toBeNull();
    expect(q('vault.viewer.trashed-banner')).toBeNull();
    expect(state.markAccessed).not.toHaveBeenCalled();
    expect(goBack).toHaveBeenCalledOnce();
  });

  // [SEC] The mirror case: once the same gate is satisfied, the trashed
  // preview renders normally — proving the gate isn't just always-false for
  // trashed docs, it genuinely depends on authorizeView's outcome.
  it('[SEC] shows content for a locked, trashed document once authorization succeeds', async () => {
    state.search = '?trashed=1';
    state.document = doc({ isLocked: true, deletedAt: '2026-07-01T00:00:00.000Z' });
    state.authorizeView.mockResolvedValue(true);
    await renderAuthorized();
    expect(state.authorizeView).toHaveBeenCalledWith(state.document);
    expect(q('vault.viewer.pages')).toBeInTheDocument();
    expect(q('vault.viewer.trashed-banner')).not.toBeNull();
  });
});
