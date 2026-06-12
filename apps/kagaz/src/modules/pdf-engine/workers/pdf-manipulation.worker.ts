import { createWorkerLogger } from '@/core/logging/worker-relay';
import { mergePdfsImpl, splitPdfImpl } from '../services/pdf-ops';
import { type PageRange, PdfEngineException } from '../types/pdf-engine.types';

const ctx = self as unknown as {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

// Create a worker logger that delegates back to the main thread
const logger = createWorkerLogger('pdf-engine-manipulation', (msg) => {
  ctx.postMessage(msg);
});

interface WorkerRequestPayload {
  id?: string;
  operation?: string;
  payload?: unknown;
}

self.onmessage = async (event: MessageEvent): Promise<void> => {
  const eventData = event.data as unknown;
  if (
    eventData &&
    typeof eventData === 'object' &&
    'type' in eventData &&
    eventData.type === 'kagaz:log'
  ) {
    return;
  }

  const request = eventData as WorkerRequestPayload | null | undefined;
  if (!request) {
    return;
  }

  const { id, operation, payload } = request;
  if (!id || !operation) {
    return;
  }

  logger.info({ event: 'worker.request.received', opId: id, operation });

  try {
    if (operation === 'mergePdfs') {
      const { pdfs } = payload as { pdfs: Uint8Array[] };
      
      const result = await mergePdfsImpl(pdfs, (progress) => {
        ctx.postMessage({ id, type: 'progress', event: progress });
      });

      logger.info({ event: 'worker.request.success', opId: id, operation });
      
      // Transfer the buffer for zero-copy efficiency
      ctx.postMessage(
        { id, type: 'result', data: result },
        [result.buffer]
      );
    } else if (operation === 'splitPdf') {
      const { pdf, ranges } = payload as { pdf: Uint8Array; ranges: PageRange[] };

      const results = await splitPdfImpl(pdf, ranges, (progress) => {
        ctx.postMessage({ id, type: 'progress', event: progress });
      });

      logger.info({ event: 'worker.request.success', opId: id, operation });

      // Transfer all resulting buffers
      const transferables = results.map(r => r.buffer);
      ctx.postMessage(
        { id, type: 'result', data: results },
        transferables
      );
    } else {
      throw new PdfEngineException(
        `Unsupported worker operation: ${operation}`,
        'WORKER_ERROR',
        operation
      );
    }
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    const code = e instanceof PdfEngineException ? e.code : 'UNKNOWN';
    const details = e instanceof PdfEngineException ? e.details : undefined;

    logger.error({
      event: 'worker.request.error',
      opId: id,
      operation,
      err: error.message
    });

    const errPayload = {
      code,
      message: error.message,
      operation,
      details
    };

    ctx.postMessage({ id, type: 'error', error: errPayload });
  }
};
