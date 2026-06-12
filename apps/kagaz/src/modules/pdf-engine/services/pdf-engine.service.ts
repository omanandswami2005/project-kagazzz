/* eslint-disable import-x/default */
import { attachWorkerLogRelay, log } from '@/core/logging';
import {
  type PdfEngineService,
  type PageRange,
  type CompressionLevel,
  type ProgressCallback,
  type PdfErrorCode,
  type ProgressEvent,
  PdfEngineException
} from '../types/pdf-engine.types';

// Vite worker loaders
import PdfManipulationWorker from '../workers/pdf-manipulation.worker?worker';
import PdfCompressWorker from '../workers/pdf-compress.worker?worker';

export class PdfEngineServiceImpl implements PdfEngineService {
  private manipulationWorker: Worker | null = null;
  private compressWorker: Worker | null = null;
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
  private cleanupCompressRelay: (() => void) | null = null;
  private serviceLogger = log('pdf-engine');

  async initialize(): Promise<void> {
    if (this.manipulationWorker && this.compressWorker) {
      return;
    }

    try {
      this.serviceLogger.info({ event: 'engine.initialize.start' });

      // Instantiate workers
      this.manipulationWorker = new PdfManipulationWorker();
      this.compressWorker = new PdfCompressWorker();

      // Set up worker listeners
      this.setupWorkerListener(this.manipulationWorker);
      this.setupWorkerListener(this.compressWorker);

      // Attach log relays
      const mainSink = {
        write: (record: Record<string, unknown>): void => {
          log('worker').info(record);
        }
      };
      
      this.cleanupManipulationRelay = attachWorkerLogRelay(this.manipulationWorker, mainSink);
      this.cleanupCompressRelay = attachWorkerLogRelay(this.compressWorker, mainSink);

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
    if (this.cleanupCompressRelay) {
      this.cleanupCompressRelay();
      this.cleanupCompressRelay = null;
    }

    if (this.manipulationWorker) {
      this.manipulationWorker.terminate();
      this.manipulationWorker = null;
    }
    if (this.compressWorker) {
      this.compressWorker.terminate();
      this.compressWorker = null;
    }

    // Reject all pending requests
    for (const active of this.activeRequests.values()) {
      active.reject(
        new PdfEngineException(
          'PDF Engine destroyed',
          'OPERATION_CANCELLED',
          'destroy'
        )
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
        active.reject(
          new PdfEngineException(message, code, operation, undefined, details)
        );
        this.activeRequests.delete(id);
      }
    });
  }

  private ensureInitialized(): void {
    if (!this.manipulationWorker || !this.compressWorker) {
      throw new PdfEngineException(
        'PDF Engine is not initialized. Call initialize() first.',
        'WORKER_ERROR',
        'ensureInitialized'
      );
    }
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
      const clonedPdfs = pdfs.map(p => new Uint8Array(p.slice()));
      const transferables = clonedPdfs.map(p => p.buffer);

      this.manipulationWorker!.postMessage(
        {
          id,
          operation: op,
          payload: { pdfs: clonedPdfs }
        },
        transferables
      );
    });
  }

  async splitPdf(pdf: Uint8Array, ranges: PageRange[], onProgress?: ProgressCallback): Promise<Uint8Array[]> {
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
          payload: { pdf: clonedPdf, ranges }
        },
        [clonedPdf.buffer]
      );
    });
  }

  async compressPdf(pdf: Uint8Array, quality: CompressionLevel, onProgress?: ProgressCallback): Promise<Uint8Array> {
    this.ensureInitialized();
    const op = 'compressPdf';
    const id = crypto.randomUUID();

    this.serviceLogger.info({ event: 'engine.request.start', opId: id, operation: op });

    return new Promise<Uint8Array>((resolve, reject) => {
      this.activeRequests.set(id, { resolve, reject, onProgress });

      // Clone to avoid detaching caller's data
      const clonedPdf = new Uint8Array(pdf.slice());

      this.compressWorker!.postMessage(
        {
          id,
          operation: op,
          payload: { pdf: clonedPdf, quality }
        },
        [clonedPdf.buffer]
      );
    });
  }
}
