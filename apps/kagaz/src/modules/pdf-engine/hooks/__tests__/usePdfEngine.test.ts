import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const { ingestFiles, read, mergePdfs, initialize, destroy } = vi.hoisted(() => ({
  ingestFiles: vi.fn(),
  read: vi.fn(),
  mergePdfs: vi.fn(),
  initialize: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock('@/modules/document-vault/hooks/useUpload', () => ({
  useUpload: () => ({ ingestFiles, isReady: true, uploadFrom: vi.fn() }),
}));
vi.mock('@/infrastructure/filesystem', () => ({
  createFileStorage: () => ({ read }),
}));
vi.mock('../../services/pdf-engine.service', () => ({
  PdfEngineServiceImpl: class {
    initialize = initialize;
    destroy = destroy;
    mergePdfs = mergePdfs;
  },
}));

import { usePdfEngine } from '../usePdfEngine';

const doc = (id: string): DocumentEntity =>
  ({ id, name: id, filePath: `documents/${id}.pdf` }) as DocumentEntity;

beforeEach(() => {
  vi.clearAllMocks();
  read.mockResolvedValue(new Uint8Array([1]));
  initialize.mockResolvedValue(undefined);
  mergePdfs.mockResolvedValue(new Uint8Array([9, 9]));
});

describe('usePdfEngine finalize phase (UX-10/11)', () => {
  it('flags "saving" while the output is written back, then clears', async () => {
    // Hold ingest open so we can observe the finalize (saving) state.
    let releaseIngest: (v: { uploaded: number; documents: [] }) => void = () => {};
    ingestFiles.mockReturnValue(
      new Promise((resolve) => {
        releaseIngest = resolve;
      })
    );

    const { result } = renderHook(() => usePdfEngine());

    let mergeDone: Promise<number>;
    await act(async () => {
      mergeDone = result.current.mergePdfs([doc('a'), doc('b')]);
    });

    // Worker finished (100%) and we're now saving to the vault.
    await waitFor(() => expect(result.current.state.saving).toBe(true));
    expect(result.current.state.percent).toBe(100);
    expect(result.current.state.busy).toBe(true);

    await act(async () => {
      releaseIngest({ uploaded: 1, documents: [] });
      await mergeDone;
    });

    // Finalize done: no longer saving or busy.
    expect(result.current.state.saving).toBe(false);
    expect(result.current.state.busy).toBe(false);
    expect(result.current.state.percent).toBe(100);
  });
});
