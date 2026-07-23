import { act, render, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import type { DocumentEntity } from '@/infrastructure/database/types';

// See PdfPageImageSheet.test.tsx for why this only asserts data-agent-state
// (IonModal doesn't present/mount children in jsdom) — form-level behavior
// is covered by parse-ranges.test.ts, which this component calls unmodified.
vi.mock('@/modules/pdf-engine/hooks/usePdfEngine', () => ({
  usePdfEngine: () => ({
    state: { busy: false, percent: 0, message: '', saving: false, error: null, errorCode: null },
    extractPages: vi.fn(async () => 1),
  }),
}));

import { PdfExtractPagesSheet } from '../PdfExtractPagesSheet';

const doc = (): DocumentEntity =>
  ({ id: 'd1', name: 'Scanned Form.pdf', filePath: 'documents/d1.pdf', fileType: 'pdf' }) as DocumentEntity;

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

describe('PdfExtractPagesSheet (F-66 UX follow-up)', () => {
  it('is closed when document is null', () => {
    render(<PdfExtractPagesSheet document={null} onClose={vi.fn()} />);
    expect(
      document
        .querySelector('[data-agent-id="vault.home.extract-pages-sheet"]')
        ?.getAttribute('data-agent-state')
    ).toBe('closed');
  });

  it('opens when a document is provided', async () => {
    const { rerender } = render(<PdfExtractPagesSheet document={null} onClose={vi.fn()} />);
    rerender(<PdfExtractPagesSheet document={doc()} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(
        document
          .querySelector('[data-agent-id="vault.home.extract-pages-sheet"]')
          ?.getAttribute('data-agent-state')
      ).toBe('open')
    );
    // See PdfPageImageSheet.test.tsx: the DOM attribute flips before
    // Ionic's own internal present() promise chain finishes draining. A
    // real macrotask tick gives it room to settle before this test's end
    // triggers testing-library's auto-cleanup/unmount, avoiding a
    // "framework delegate is missing" unhandled rejection on slow runners.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });
});
