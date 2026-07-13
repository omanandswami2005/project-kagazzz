/**
 * PDF Tools engine hook (F-3..F-7, F-21, F-22, F-28). Owns one
 * {@link PdfEngineServiceImpl} for the screen's lifetime, reads input bytes
 * from the vault's FileStorage, runs an operation in the engine's workers, and
 * saves the result(s) back into the vault through the upload pipeline. Exposes
 * a single busy/progress/error state the page renders.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { log } from '@/core/logging';
import { createFileStorage } from '@/infrastructure/filesystem';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { useUpload } from '@/modules/document-vault/hooks/useUpload';
import type { IncomingFile } from '@/modules/document-vault/types/document.types';
import { PdfEngineServiceImpl } from '../services/pdf-engine.service';
import {
  pdfErrorInfoOf,
  PdfEngineException,
  type CompressionLevel,
  type FormField,
  type PageNumberOptions,
  type PageOp,
  type PageRange,
  type PdfMetadata,
  type PdfErrorCode,
  type ProgressEvent,
  type RenderOptions,
  type StampOptions,
} from '../types/pdf-engine.types';

const logger = log('pdf-engine');

/** Strips a file extension for building derived output names. */
function baseName(name: string): string {
  return name.replace(/\.[^/.]+$/, '');
}

/** The text export formats offered by F-40 (PDF → text / Markdown). */
export type TextExportFormat = 'txt' | 'md';

/**
 * Wraps extracted PDF text as a small Markdown document (F-40): a title heading
 * from the source name, then the text with page breaks kept as blank lines.
 */
function toMarkdown(sourceName: string, text: string): string {
  return `# ${baseName(sourceName)}\n\n${text}\n`;
}

/** Live status of the current operation. */
export interface PdfRunState {
  busy: boolean;
  /** 0–100. */
  percent: number;
  message: string;
  /**
   * True while saving the finished output back into the vault (UX-10/11): the
   * worker has hit 100% but the result is still being thumbnailed + written +
   * indexed. The merged/compressed PDF's thumbnail is the first pdfjs use, so
   * this "finalizing" step can take a moment — surfacing it stops the progress
   * bar from sitting at a silent 100%.
   */
  saving: boolean;
  /** Raw error message (diagnostics), or null. */
  error: string | null;
  /** Machine-readable code so the UI can show a specific message, or null. */
  errorCode: PdfErrorCode | null;
}

const IDLE: PdfRunState = {
  busy: false,
  percent: 0,
  message: '',
  saving: false,
  error: null,
  errorCode: null,
};

/** What {@link usePdfEngine} exposes to the PDF Tools page. */
export interface UsePdfEngineResult {
  state: PdfRunState;
  /** Clears any error so the UI can retry. */
  reset: () => void;
  mergePdfs: (docs: DocumentEntity[]) => Promise<number>;
  splitPdf: (doc: DocumentEntity, ranges: PageRange[]) => Promise<number>;
  /** Renders every page to a preview image blob (F-35 organizer; no save). */
  loadPagePreviews: (doc: DocumentEntity) => Promise<Blob[]>;
  organizePages: (doc: DocumentEntity, ops: PageOp[]) => Promise<number>;
  watermarkPdf: (doc: DocumentEntity, text: string) => Promise<number>;
  addPageNumbers: (doc: DocumentEntity, options: PageNumberOptions) => Promise<number>;
  compressPdf: (doc: DocumentEntity, quality: CompressionLevel) => Promise<number>;
  imagesToPdf: (images: DocumentEntity[]) => Promise<number>;
  stampImage: (
    doc: DocumentEntity,
    image: DocumentEntity,
    options: StampOptions
  ) => Promise<number>;
  pdfToImages: (doc: DocumentEntity, options: RenderOptions) => Promise<number>;
  exportPdfText: (doc: DocumentEntity, format: TextExportFormat) => Promise<number>;
  exportPdfToWord: (doc: DocumentEntity) => Promise<number>;
  encryptPdf: (doc: DocumentEntity, password: string) => Promise<number>;
  decryptPdf: (doc: DocumentEntity, password: string) => Promise<number>;
  /** Reads a form PDF's fields (no save). */
  loadFormFields: (doc: DocumentEntity) => Promise<FormField[]>;
  fillForm: (doc: DocumentEntity, values: Record<string, string>) => Promise<number>;
  /** Reads a PDF's metadata (no save). */
  loadMetadata: (doc: DocumentEntity) => Promise<PdfMetadata>;
  setMetadata: (doc: DocumentEntity, metadata: PdfMetadata) => Promise<number>;
}

const MIME_FOR: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

/** Wires the PDF engine into the PDF Tools screen. */
export function usePdfEngine(): UsePdfEngineResult {
  const { ingestFiles } = useUpload();
  const engineRef = useRef<PdfEngineServiceImpl | null>(null);
  const storageRef = useRef(createFileStorage());
  const [state, setState] = useState<PdfRunState>(IDLE);

  // One engine per screen; torn down (workers terminated) on unmount.
  useEffect(() => {
    return (): void => {
      void engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, []);

  const getEngine = useCallback(async (): Promise<PdfEngineServiceImpl> => {
    if (!engineRef.current) {
      const engine = new PdfEngineServiceImpl();
      await engine.initialize();
      engineRef.current = engine;
    }
    return engineRef.current;
  }, []);

  const readBytes = useCallback(
    (doc: DocumentEntity): Promise<Uint8Array> => storageRef.current.read(doc.filePath),
    []
  );

  const save = useCallback(
    async (files: IncomingFile[]): Promise<number> => {
      // UX-10/11: the worker is done (100%); the save/thumbnail/index step now
      // runs. Flag it so the UI shows "Finalizing…" instead of a frozen 100%.
      setState((s) => ({ ...s, percent: 100, saving: true }));
      const { uploaded } = await ingestFiles(files);
      return uploaded;
    },
    [ingestFiles]
  );

  const reset = useCallback(() => setState(IDLE), []);

  /** Runs `op` with busy/progress/error bookkeeping; resolves the saved count. */
  const run = useCallback(
    async (
      op: (
        engine: PdfEngineServiceImpl,
        onProgress: (e: ProgressEvent) => void
      ) => Promise<number>
    ): Promise<number> => {
      setState({ ...IDLE, busy: true });
      try {
        const engine = await getEngine();
        const count = await op(engine, (e) =>
          setState((s) => ({ ...s, percent: e.percent, message: e.message }))
        );
        setState((s) => ({ ...s, busy: false, saving: false, percent: 100 }));
        return count;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        const { code } = pdfErrorInfoOf(err);
        logger.error({ event: 'pdf.tool.failed', code, err: { message } });
        setState((s) => ({
          ...s,
          busy: false,
          saving: false,
          error: message,
          errorCode: code,
        }));
        return 0;
      }
    },
    [getEngine]
  );

  const mergePdfs = useCallback(
    (docs: DocumentEntity[]): Promise<number> =>
      run(async (engine, onProgress) => {
        const inputs = await Promise.all(docs.map(readBytes));
        const merged = await engine.mergePdfs(inputs, onProgress);
        return save([
          { name: 'Merged document.pdf', blob: blobOf(merged, 'pdf'), source: 'ai_generated' },
        ]);
      }),
    [run, readBytes, save]
  );

  const splitPdf = useCallback(
    (doc: DocumentEntity, ranges: PageRange[]): Promise<number> =>
      run(async (engine, onProgress) => {
        const parts = await engine.splitPdf(await readBytes(doc), ranges, onProgress);
        return save(
          parts.map((part, i) => ({
            name: `${baseName(doc.name)}_part${i + 1}.pdf`,
            blob: blobOf(part, 'pdf'),
            source: 'ai_generated' as const,
          }))
        );
      }),
    [run, readBytes, save]
  );

  const loadPagePreviews = useCallback(
    async (doc: DocumentEntity): Promise<Blob[]> => {
      const engine = await getEngine();
      // Low scale — thumbnails only, keeps the render fast and memory small.
      return engine.pdfToImages(await readBytes(doc), { format: 'jpeg', scale: 0.5 });
    },
    [getEngine, readBytes]
  );

  const organizePages = useCallback(
    (doc: DocumentEntity, ops: PageOp[]): Promise<number> =>
      run(async (engine, onProgress) => {
        const out = await engine.organizePages(await readBytes(doc), ops, onProgress);
        return save([
          {
            name: `${baseName(doc.name)}_organized.pdf`,
            blob: blobOf(out, 'pdf'),
            source: 'ai_generated',
          },
        ]);
      }),
    [run, readBytes, save]
  );

  const watermarkPdf = useCallback(
    (doc: DocumentEntity, text: string): Promise<number> =>
      run(async (engine, onProgress) => {
        const out = await engine.watermarkPdf(await readBytes(doc), text, onProgress);
        return save([
          {
            name: `${baseName(doc.name)}_watermarked.pdf`,
            blob: blobOf(out, 'pdf'),
            source: 'ai_generated',
          },
        ]);
      }),
    [run, readBytes, save]
  );

  const addPageNumbers = useCallback(
    (doc: DocumentEntity, options: PageNumberOptions): Promise<number> =>
      run(async (engine, onProgress) => {
        const out = await engine.addPageNumbers(await readBytes(doc), options, onProgress);
        return save([
          {
            name: `${baseName(doc.name)}_numbered.pdf`,
            blob: blobOf(out, 'pdf'),
            source: 'ai_generated',
          },
        ]);
      }),
    [run, readBytes, save]
  );

  const compressPdf = useCallback(
    (doc: DocumentEntity, quality: CompressionLevel): Promise<number> =>
      run(async (engine, onProgress) => {
        const out = await engine.compressPdf(await readBytes(doc), quality, onProgress);
        return save([
          {
            name: `${baseName(doc.name)}_compressed.pdf`,
            blob: blobOf(out, 'pdf'),
            source: 'ai_generated',
          },
        ]);
      }),
    [run, readBytes, save]
  );

  const imagesToPdf = useCallback(
    (images: DocumentEntity[]): Promise<number> =>
      run(async (engine, onProgress) => {
        const inputs = await Promise.all(
          images.map(async (doc) => ({
            data: await readBytes(doc),
            mimeType: MIME_FOR[doc.fileType.toLowerCase()] ?? 'image/jpeg',
          }))
        );
        const pdf = await engine.imagesToPdf(inputs, onProgress);
        return save([
          { name: 'Images.pdf', blob: blobOf(pdf, 'pdf'), source: 'ai_generated' },
        ]);
      }),
    [run, readBytes, save]
  );

  const stampImage = useCallback(
    (
      doc: DocumentEntity,
      image: DocumentEntity,
      options: StampOptions
    ): Promise<number> =>
      run(async (engine, onProgress) => {
        const [pdfBytes, imageBytes] = await Promise.all([
          readBytes(doc),
          readBytes(image),
        ]);
        const out = await engine.stampImage(
          pdfBytes,
          {
            data: imageBytes,
            mimeType: MIME_FOR[image.fileType.toLowerCase()] ?? 'image/jpeg',
          },
          options,
          onProgress
        );
        return save([
          {
            name: `${baseName(doc.name)}_signed.pdf`,
            blob: blobOf(out, 'pdf'),
            source: 'ai_generated',
          },
        ]);
      }),
    [run, readBytes, save]
  );

  const pdfToImages = useCallback(
    (doc: DocumentEntity, options: RenderOptions): Promise<number> =>
      run(async (engine, onProgress) => {
        const blobs = await engine.pdfToImages(await readBytes(doc), options, onProgress);
        const ext = options.format === 'jpeg' ? 'jpg' : 'png';
        return save(
          blobs.map((blob, i) => ({
            name: `${baseName(doc.name)}_page${i + 1}.${ext}`,
            blob,
            source: 'ai_generated' as const,
          }))
        );
      }),
    [run, readBytes, save]
  );

  const exportPdfText = useCallback(
    (doc: DocumentEntity, format: TextExportFormat): Promise<number> =>
      run(async (engine) => {
        const text = await engine.extractText(await readBytes(doc));
        if (!text.trim()) {
          // Scanned/image-only PDFs have no text layer — tell the user to OCR.
          throw new PdfEngineException(
            'This PDF has no selectable text',
            'NO_TEXT_LAYER',
            'extractText'
          );
        }
        const body = format === 'md' ? toMarkdown(doc.name, text) : `${text}\n`;
        const mime = format === 'md' ? 'text/markdown' : 'text/plain';
        return save([
          {
            name: `${baseName(doc.name)}.${format}`,
            blob: new Blob([body], { type: mime }),
            source: 'ai_generated',
          },
        ]);
      }),
    [run, readBytes, save]
  );

  const exportPdfToWord = useCallback(
    (doc: DocumentEntity): Promise<number> =>
      run(async (engine) => {
        const blob = await engine.pdfToWord(await readBytes(doc), baseName(doc.name));
        return save([
          { name: `${baseName(doc.name)}.docx`, blob, source: 'ai_generated' },
        ]);
      }),
    [run, readBytes, save]
  );

  const encryptPdf = useCallback(
    (doc: DocumentEntity, password: string): Promise<number> =>
      run(async (engine) => {
        const out = await engine.encryptPdf(await readBytes(doc), password);
        return save([
          {
            name: `${baseName(doc.name)}_locked.pdf`,
            blob: blobOf(out, 'pdf'),
            source: 'ai_generated',
          },
        ]);
      }),
    [run, readBytes, save]
  );

  const decryptPdf = useCallback(
    (doc: DocumentEntity, password: string): Promise<number> =>
      run(async (engine) => {
        const out = await engine.decryptPdf(await readBytes(doc), password);
        return save([
          {
            name: `${baseName(doc.name)}_unlocked.pdf`,
            blob: blobOf(out, 'pdf'),
            source: 'ai_generated',
          },
        ]);
      }),
    [run, readBytes, save]
  );

  const loadFormFields = useCallback(
    async (doc: DocumentEntity): Promise<FormField[]> => {
      const engine = await getEngine();
      return engine.getFormFields(await readBytes(doc));
    },
    [getEngine, readBytes]
  );

  const loadMetadata = useCallback(
    async (doc: DocumentEntity): Promise<PdfMetadata> => {
      const engine = await getEngine();
      return engine.getMetadata(await readBytes(doc));
    },
    [getEngine, readBytes]
  );

  const setMetadata = useCallback(
    (doc: DocumentEntity, metadata: PdfMetadata): Promise<number> =>
      run(async (engine) => {
        const out = await engine.setMetadata(await readBytes(doc), metadata);
        return save([
          {
            name: `${baseName(doc.name)}_updated.pdf`,
            blob: blobOf(out, 'pdf'),
            source: 'ai_generated',
          },
        ]);
      }),
    [run, readBytes, save]
  );

  const fillForm = useCallback(
    (doc: DocumentEntity, values: Record<string, string>): Promise<number> =>
      run(async (engine) => {
        const out = await engine.fillForm(await readBytes(doc), values);
        return save([
          {
            name: `${baseName(doc.name)}_filled.pdf`,
            blob: blobOf(out, 'pdf'),
            source: 'ai_generated',
          },
        ]);
      }),
    [run, readBytes, save]
  );

  return {
    state,
    reset,
    mergePdfs,
    splitPdf,
    loadPagePreviews,
    organizePages,
    watermarkPdf,
    addPageNumbers,
    compressPdf,
    imagesToPdf,
    stampImage,
    pdfToImages,
    exportPdfText,
    exportPdfToWord,
    encryptPdf,
    decryptPdf,
    loadFormFields,
    fillForm,
    loadMetadata,
    setMetadata,
  };
}

/** Wraps engine bytes in a typed Blob for the upload pipeline. */
function blobOf(bytes: Uint8Array, fileType: 'pdf'): Blob {
  return new Blob([bytes as BlobPart], { type: MIME_FOR[fileType] });
}
