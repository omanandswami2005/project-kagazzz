import { act, render, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import type { DocumentEntity } from '@/infrastructure/database/types';

// IonModal doesn't present/mount its children in jsdom (no framework
// delegate) — same limitation every other IonModal-based sheet in this
// codebase works around by only asserting the wrapping element's
// data-agent-state, not querying into its content. Form-level behavior
// (page-range validation, flattening) is covered directly by
// parse-ranges.test.ts, which this component calls without modification.
vi.mock('@/modules/pdf-engine/hooks/usePdfEngine', () => ({
  usePdfEngine: () => ({
    state: { busy: false, percent: 0, message: '', saving: false, error: null, errorCode: null },
    pdfToImages: vi.fn(async () => 1),
  }),
}));

import { PdfPageImageSheet } from '../PdfPageImageSheet';

const doc = (): DocumentEntity =>
  ({ id: 'd1', name: 'Scanned Form.pdf', filePath: 'documents/d1.pdf', fileType: 'pdf' }) as DocumentEntity;

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

describe('PdfPageImageSheet (F-86)', () => {
  it('is closed when document is null', () => {
    render(<PdfPageImageSheet document={null} onClose={vi.fn()} />);
    expect(
      document
        .querySelector('[data-agent-id="vault.home.page-image-sheet"]')
        ?.getAttribute('data-agent-state')
    ).toBe('closed');
  });

  it('opens when a document is provided', async () => {
    // Starts closed then transitions, like real usage (VaultHomePage sets
    // pageImageDoc from null) — and awaits the transition so Ionic's custom
    // element upgrade has a real microtask tick to settle (a bare synchronous
    // rerender leaves its internal present() call racing past teardown,
    // surfacing as an unhandled "framework delegate is missing" rejection
    // that fails the run despite the assertions themselves passing).
    const { rerender } = render(<PdfPageImageSheet document={null} onClose={vi.fn()} />);
    rerender(<PdfPageImageSheet document={doc()} onClose={vi.fn()} />);
    await waitFor(() =>
      expect(
        document
          .querySelector('[data-agent-id="vault.home.page-image-sheet"]')
          ?.getAttribute('data-agent-state')
      ).toBe('open')
    );
    // The DOM attribute above flips before Ionic's own internal present()
    // promise chain (a separate, unobserved chain) finishes draining — on a
    // slow CI runner that chain can still be in flight when this test ends
    // and testing-library's auto-cleanup unmounts, so it resolves against a
    // detached host and throws "framework delegate is missing" as an
    // unhandled rejection. A real macrotask tick gives it room to settle
    // before teardown.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
  });
});
