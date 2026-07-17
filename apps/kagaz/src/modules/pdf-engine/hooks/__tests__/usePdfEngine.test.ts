import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';

const { ingestFiles, read, mergePdfs, imagesToPdf, pickFromScanner, initialize, destroy } =
  vi.hoisted(() => ({
    ingestFiles: vi.fn(),
    read: vi.fn(),
    mergePdfs: vi.fn(),
    imagesToPdf: vi.fn(),
    pickFromScanner: vi.fn(),
    initialize: vi.fn(),
    destroy: vi.fn(),
  }));

vi.mock('@/modules/document-vault/hooks/useUpload', () => ({
  useUpload: () => ({ ingestFiles, isReady: true, uploadFrom: vi.fn() }),
}));
vi.mock('@/modules/document-vault/services/upload-sources', () => ({ pickFromScanner }));
vi.mock('@/infrastructure/filesystem', () => ({
  createFileStorage: () => ({ read }),
}));
vi.mock('../../services/pdf-engine.service', () => ({
  PdfEngineServiceImpl: class {
    initialize = initialize;
    destroy = destroy;
    mergePdfs = mergePdfs;
    imagesToPdf = imagesToPdf;
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
  imagesToPdf.mockResolvedValue(new Uint8Array([7]));
  ingestFiles.mockResolvedValue({ uploaded: 1, documents: [] });
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

describe('usePdfEngine.appendScan (F-44)', () => {
  const pdfDoc = (): DocumentEntity =>
    ({ id: 'src', name: 'contract.pdf', filePath: 'documents/src.pdf' }) as DocumentEntity;

  it('returns 0 without merging or saving when the scan is cancelled', async () => {
    pickFromScanner.mockResolvedValue([]);
    const { result } = renderHook(() => usePdfEngine());

    let count = -1;
    await act(async () => {
      count = await result.current.appendScan(pdfDoc());
    });

    expect(count).toBe(0);
    expect(mergePdfs).not.toHaveBeenCalled();
    expect(ingestFiles).not.toHaveBeenCalled();
  });

  it('merges a combined-PDF scan onto the source and saves an _appended.pdf', async () => {
    pickFromScanner.mockResolvedValue([
      { name: 'Scan.pdf', blob: new Blob([new Uint8Array([5, 5])]), source: 'scanner' },
    ]);
    const { result } = renderHook(() => usePdfEngine());

    let count = -1;
    await act(async () => {
      count = await result.current.appendScan(pdfDoc());
    });

    expect(count).toBe(1);
    // A PDF scan is not re-packed through images → PDF.
    expect(imagesToPdf).not.toHaveBeenCalled();
    // Source bytes first, then the scanned PDF.
    expect(mergePdfs).toHaveBeenCalledWith(
      [expect.any(Uint8Array), expect.any(Uint8Array)],
      expect.any(Function)
    );
    expect(ingestFiles).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'contract_appended.pdf', source: 'scanner' }),
    ]);
  });

  it('packs single-page JPEG scans into a PDF before merging', async () => {
    pickFromScanner.mockResolvedValue([
      { name: 'Scan.jpg', blob: new Blob([new Uint8Array([1])], { type: 'image/jpeg' }), source: 'scanner' },
    ]);
    const { result } = renderHook(() => usePdfEngine());

    await act(async () => {
      await result.current.appendScan(pdfDoc());
    });

    expect(imagesToPdf).toHaveBeenCalledTimes(1);
    expect(mergePdfs).toHaveBeenCalledTimes(1);
  });
});
