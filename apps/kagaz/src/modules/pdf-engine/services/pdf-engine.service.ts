/* eslint-disable import-x/default */
import { attachWorkerLogRelay, log } from '@/core/logging';
import {
  type PdfEngineService,
  type PageRange,
  type CompressionLevel,
  type EncryptOptions,
  type FormField,
  type ImageInput,
  type PageNumberOptions,
  type PdfMetadata,
  type ProgressCallback,
  type StampOptions,
  type PdfErrorCode,
  type ProgressEvent,
  type RenderOptions,
  PdfEngineException,
} from '../types/pdf-engine.types';

import { extractPdfTextImpl, pdfToImagesImpl } from './pdf-render-ops';
import { compressPdfImpl } from './pdf-compress-ops';

// Vite worker loader (pdf-lib / pdfsmaller ops — no DOM needed).
import PdfManipulationWorker from '../workers/pdf-manipulation.worker?worker';

/** Clones a Uint8Array so transferring its buffer never detaches the caller's. */
const clone = (data: Uint8Array): Uint8Array => new Uint8Array(data.slice());

export class PdfEngineServiceImpl implements PdfEngineService {
  private manipulationWorker: Worker | null = null;
  private activeRequests = new Map<
    string,
    {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolve: (value: any) => void;
      reject: (err: unknown) => void;
      onProgress?: ProgressCallback;
    }
  >();

  private cleanupManipulationRelay: (() => void) | null = null;
  private serviceLogger = log('pdf-engine');

  async initialize(): Promise<void> {
    if (this.manipulationWorker) {
      return;
    }

    try {
      this.serviceLogger.info({ event: 'engine.initialize.start' });

      // Instantiate the manipulation worker (compress + render run on the
      // main thread because their libraries need a DOM canvas).
      this.manipulationWorker = new PdfManipulationWorker();
      this.setupWorkerListener(this.manipulationWorker);

      // Attach the log relay.
      const mainSink = {
        write: (record: Record<string, unknown>): void => {
          log('worker').info(record);
        },
      };

      this.cleanupManipulationRelay = attachWorkerLogRelay(this.manipulationWorker, mainSink);

      this.serviceLogger.info({ event: 'engine.initialize.success' });
      await Promise.resolve();
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      this.serviceLogger.error({ event: 'engine.initialize.error', err: error.message });
      throw new PdfEngineException(
        `Failed to initialize PDF workers: ${error.message}`,
        'WORKER_ERROR',
        'initialize',
        error
      );
    }
  }

  async destroy(): Promise<void> {
    this.serviceLogger.info({ event: 'engine.destroy.start' });

    if (this.cleanupManipulationRelay) {
      this.cleanupManipulationRelay();
      this.cleanupManipulationRelay = null;
    }
    if (this.manipulationWorker) {
      this.manipulationWorker.terminate();
      this.manipulationWorker = null;
    }

    // Reject all pending requests
    for (const active of this.activeRequests.values()) {
      active.reject(
        new PdfEngineException('PDF Engine destroyed', 'OPERATION_CANCELLED', 'destroy')
      );
    }
    this.activeRequests.clear();

    this.serviceLogger.info({ event: 'engine.destroy.success' });
    await Promise.resolve();
  }

  private setupWorkerListener(worker: Worker): void {
    worker.addEventListener('message', (event: MessageEvent) => {
      const eventData = event.data as unknown;
      if (
        eventData &&
        typeof eventData === 'object' &&
        'type' in eventData &&
        eventData.type === 'kagaz:log'
      ) {
        return;
      }

      interface WorkerMessagePayload {
        id?: string;
        type?: 'result' | 'progress' | 'error';
        data?: unknown;
        event?: ProgressEvent;
        error?: {
          code: PdfErrorCode;
          message: string;
          operation: string;
          details?: Record<string, unknown>;
        };
      }

      const payload = eventData as WorkerMessagePayload | null | undefined;
      if (!payload) return;

      const { id, type, data: resultData, event: progressEvent, error } = payload;
      if (!id) return;

      const active = this.activeRequests.get(id);
      if (!active) return;

      if (type === 'progress') {
        if (active.onProgress && progressEvent) {
          active.onProgress(progressEvent);
        }
      } else if (type === 'result') {
        active.resolve(resultData);
        this.activeRequests.delete(id);
      } else if (type === 'error') {
        const code = error?.code || 'UNKNOWN';
        const message = error?.message || 'Unknown worker error';
        const operation = error?.operation || 'unknown';
        const details = error?.details;
        active.reject(new PdfEngineException(message, code, operation, undefined, details));
        this.activeRequests.delete(id);
      }
    });
  }

  private ensureInitialized(): void {
    if (!this.manipulationWorker) {
      throw new PdfEngineException(
        'PDF Engine is not initialized. Call initialize() first.',
        'WORKER_ERROR',
        'ensureInitialized'
      );
    }
  }

  /**
   * Posts one request to a worker and resolves with its result. The caller
   * is responsible for cloning any buffers it lists in `transfer` (so the
   * original data is never detached).
   */
  private dispatch<T>(
    worker: Worker,
    operation: string,
    payload: Record<string, unknown>,
    transfer: Transferable[],
    onProgress?: ProgressCallback
  ): Promise<T> {
    const id = crypto.randomUUID();
    this.serviceLogger.info({ event: 'engine.request.start', opId: id, operation });
    return new Promise<T>((resolve, reject) => {
      this.activeRequests.set(id, { resolve, reject, onProgress });
      worker.postMessage({ id, operation, payload }, transfer);
    });
  }

  async mergePdfs(pdfs: Uint8Array[], onProgress?: ProgressCallback): Promise<Uint8Array> {
    this.ensureInitialized();
    const op = 'mergePdfs';
    const id = crypto.randomUUID();

    if (!pdfs || pdfs.length === 0) {
      throw new PdfEngineException('No PDFs provided to merge', 'INVALID_PDF', op);
    }

    this.serviceLogger.info({ event: 'engine.request.start', opId: id, operation: op });

    return new Promise<Uint8Array>((resolve, reject) => {
      this.activeRequests.set(id, { resolve, reject, onProgress });

      // Clone buffers to avoid detaching caller's data
      const clonedPdfs = pdfs.map((p) => new Uint8Array(p.slice()));
      const transferables = clonedPdfs.map((p) => p.buffer);

      this.manipulationWorker!.postMessage(
        {
          id,
          operation: op,
          payload: { pdfs: clonedPdfs },
        },
        transferables
      );
    });
  }

  async splitPdf(
    pdf: Uint8Array,
    ranges: PageRange[],
    onProgress?: ProgressCallback
  ): Promise<Uint8Array[]> {
    this.ensureInitialized();
    const op = 'splitPdf';
    const id = crypto.randomUUID();

    this.serviceLogger.info({ event: 'engine.request.start', opId: id, operation: op });

    return new Promise<Uint8Array[]>((resolve, reject) => {
      this.activeRequests.set(id, { resolve, reject, onProgress });

      // Clone to avoid detaching caller's data
      const clonedPdf = new Uint8Array(pdf.slice());

      this.manipulationWorker!.postMessage(
        {
          id,
          operation: op,
          payload: { pdf: clonedPdf, ranges },
        },
        [clonedPdf.buffer]
      );
    });
  }

  async compressPdf(
    pdf: Uint8Array,
    quality: CompressionLevel,
    onProgress?: ProgressCallback
  ): Promise<Uint8Array> {
    this.ensureInitialized();
    const op = 'compressPdf';
    const id = crypto.randomUUID();
    // Compression rasterises pages via pdfjs + canvas, which a Web Worker
    // lacks — so it runs on the main thread (like F-6 render).
    this.serviceLogger.info({ event: 'engine.request.start', opId: id, operation: op });
    try {
      const out = await compressPdfImpl(clone(pdf), quality, onProgress);
      this.serviceLogger.info({ event: 'engine.request.success', opId: id, operation: op });
      return out;
    } catch (e: unknown) {
      this.serviceLogger.error({
        event: 'engine.request.error',
        opId: id,
        operation: op,
        err: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  async imagesToPdf(
    images: ImageInput[],
    onProgress?: ProgressCallback
  ): Promise<Uint8Array> {
    this.ensureInitialized();
    if (!images || images.length === 0) {
      throw new PdfEngineException('No images provided', 'UNSUPPORTED_FORMAT', 'imagesToPdf');
    }
    const cloned = images.map((img) => ({
      data: clone(img.data),
      mimeType: img.mimeType,
    }));
    return this.dispatch<Uint8Array>(
      this.manipulationWorker!,
      'imagesToPdf',
      { images: cloned },
      cloned.map((img) => img.data.buffer),
      onProgress
    );
  }

  async watermarkPdf(
    pdf: Uint8Array,
    text: string,
    onProgress?: ProgressCallback
  ): Promise<Uint8Array> {
    this.ensureInitialized();
    const clonedPdf = clone(pdf);
    return this.dispatch<Uint8Array>(
      this.manipulationWorker!,
      'watermarkPdf',
      { pdf: clonedPdf, text },
      [clonedPdf.buffer],
      onProgress
    );
  }

  async stampImage(
    pdf: Uint8Array,
    image: ImageInput,
    options: StampOptions,
    onProgress?: ProgressCallback
  ): Promise<Uint8Array> {
    this.ensureInitialized();
    const clonedPdf = clone(pdf);
    const clonedImage: ImageInput = {
      data: clone(image.data),
      mimeType: image.mimeType,
    };
    return this.dispatch<Uint8Array>(
      this.manipulationWorker!,
      'stampImage',
      { pdf: clonedPdf, image: clonedImage, options },
      [clonedPdf.buffer, clonedImage.data.buffer],
      onProgress
    );
  }

  async addPageNumbers(
    pdf: Uint8Array,
    options: PageNumberOptions,
    onProgress?: ProgressCallback
  ): Promise<Uint8Array> {
    this.ensureInitialized();
    const clonedPdf = clone(pdf);
    return this.dispatch<Uint8Array>(
      this.manipulationWorker!,
      'addPageNumbers',
      { pdf: clonedPdf, options },
      [clonedPdf.buffer],
      onProgress
    );
  }

  async extractText(pdf: Uint8Array): Promise<string> {
    this.ensureInitialized();
    // pdfjs text extraction needs browser globals, so — like pdfToImages — it
    // runs on the main thread rather than in a Vite module worker.
    const id = crypto.randomUUID();
    this.serviceLogger.info({ event: 'engine.request.start', opId: id, operation: 'extractText' });
    try {
      // [SEC] the extracted text is document content — never logged here.
      const text = await extractPdfTextImpl(clone(pdf));
      this.serviceLogger.info({ event: 'engine.request.success', opId: id, operation: 'extractText' });
      return text;
    } catch (e: unknown) {
      this.serviceLogger.error({
        event: 'engine.request.error',
        opId: id,
        operation: 'extractText',
        err: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  async pdfToImages(
    pdf: Uint8Array,
    options: RenderOptions,
    onProgress?: ProgressCallback
  ): Promise<Blob[]> {
    this.ensureInitialized();
    // pdfjs rendering needs a canvas, so this runs on the main thread (the
    // same proven path the vault uses for thumbnails) rather than a worker —
    // pdfjs does not initialise reliably inside a Vite module worker.
    const id = crypto.randomUUID();
    this.serviceLogger.info({ event: 'engine.request.start', opId: id, operation: 'pdfToImages' });
    try {
      const blobs = await pdfToImagesImpl(clone(pdf), options, onProgress);
      this.serviceLogger.info({ event: 'engine.request.success', opId: id, operation: 'pdfToImages' });
      return blobs;
    } catch (e: unknown) {
      this.serviceLogger.error({
        event: 'engine.request.error',
        opId: id,
        operation: 'pdfToImages',
        err: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  async encryptPdf(
    pdf: Uint8Array,
    password: string,
    options?: EncryptOptions
  ): Promise<Uint8Array> {
    this.ensureInitialized();
    const clonedPdf = clone(pdf);
    // [SEC] password travels only in the payload — never logged.
    return this.dispatch<Uint8Array>(
      this.manipulationWorker!,
      'encryptPdf',
      { pdf: clonedPdf, password, options },
      [clonedPdf.buffer]
    );
  }

  async decryptPdf(pdf: Uint8Array, password: string): Promise<Uint8Array> {
    this.ensureInitialized();
    const clonedPdf = clone(pdf);
    return this.dispatch<Uint8Array>(
      this.manipulationWorker!,
      'decryptPdf',
      { pdf: clonedPdf, password },
      [clonedPdf.buffer]
    );
  }

  async getMetadata(pdf: Uint8Array): Promise<PdfMetadata> {
    this.ensureInitialized();
    const clonedPdf = clone(pdf);
    return this.dispatch<PdfMetadata>(
      this.manipulationWorker!,
      'getMetadata',
      { pdf: clonedPdf },
      [clonedPdf.buffer]
    );
  }

  async setMetadata(pdf: Uint8Array, metadata: PdfMetadata): Promise<Uint8Array> {
    this.ensureInitialized();
    const clonedPdf = clone(pdf);
    return this.dispatch<Uint8Array>(
      this.manipulationWorker!,
      'setMetadata',
      { pdf: clonedPdf, metadata },
      [clonedPdf.buffer]
    );
  }

  async getFormFields(pdf: Uint8Array): Promise<FormField[]> {
    this.ensureInitialized();
    const clonedPdf = clone(pdf);
    return this.dispatch<FormField[]>(
      this.manipulationWorker!,
      'getFormFields',
      { pdf: clonedPdf },
      [clonedPdf.buffer]
    );
  }

  async fillForm(
    pdf: Uint8Array,
    values: Record<string, string>
  ): Promise<Uint8Array> {
    this.ensureInitialized();
    const clonedPdf = clone(pdf);
    return this.dispatch<Uint8Array>(
      this.manipulationWorker!,
      'fillForm',
      { pdf: clonedPdf, values },
      [clonedPdf.buffer]
    );
  }
}
