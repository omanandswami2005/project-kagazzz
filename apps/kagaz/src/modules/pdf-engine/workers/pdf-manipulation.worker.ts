import { createWorkerLogger } from '@/core/logging/worker-relay';
import {
  addPageNumbersImpl,
  imagesToPdfImpl,
  mergePdfsImpl,
  splitPdfImpl,
  stampImageImpl,
  watermarkPdfImpl,
} from '../services/pdf-ops';
import { decryptPdfImpl, encryptPdfImpl } from '../services/pdf-security-ops';
import { fillFormImpl, getFormFieldsImpl } from '../services/pdf-forms-ops';
import { getPdfMetadataImpl, setPdfMetadataImpl } from '../services/pdf-metadata-ops';
import {
  type EncryptOptions,
  type ImageInput,
  type PageNumberOptions,
  type PageRange,
  type PdfMetadata,
  type ProgressEvent,
  type StampOptions,
  PdfEngineException,
  pdfErrorInfoOf,
} from '../types/pdf-engine.types';

const ctx = self as unknown as {
  postMessage: (message: unknown, transfer?: Transferable[]) => void;
};

// Worker logger that relays records to the main thread. [SEC] only operation
// names + ids are logged here — never the payload, so PDF passwords never leak.
const logger = createWorkerLogger('pdf-engine-manipulation', (msg) => {
  ctx.postMessage(msg);
});

interface WorkerRequestPayload {
  id?: string;
  operation?: string;
  payload?: unknown;
}

/** The outcome of an operation: a value to return + buffers to transfer. */
interface OpResult {
  data: unknown;
  transfer: Transferable[];
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

  const emit = (progress: ProgressEvent): void => {
    ctx.postMessage({ id, type: 'progress', event: progress });
  };

  try {
    const { data, transfer } = await run(operation, payload, emit);
    logger.info({ event: 'worker.request.success', opId: id, operation });
    ctx.postMessage({ id, type: 'result', data }, transfer);
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    const { code, details } = pdfErrorInfoOf(e);

    logger.error({
      event: 'worker.request.error',
      opId: id,
      operation,
      err: error.message,
    });

    ctx.postMessage({
      id,
      type: 'error',
      error: { code, message: error.message, operation, details },
    });
  }
};

/** Runs one manipulation operation and reports what to transfer back. */
async function run(
  operation: string,
  payload: unknown,
  emit: (progress: ProgressEvent) => void
): Promise<OpResult> {
  switch (operation) {
    case 'mergePdfs': {
      const { pdfs } = payload as { pdfs: Uint8Array[] };
      const result = await mergePdfsImpl(pdfs, emit);
      return { data: result, transfer: [result.buffer] };
    }
    case 'splitPdf': {
      const { pdf, ranges } = payload as { pdf: Uint8Array; ranges: PageRange[] };
      const results = await splitPdfImpl(pdf, ranges, emit);
      return { data: results, transfer: results.map((r) => r.buffer) };
    }
    case 'imagesToPdf': {
      const { images } = payload as { images: ImageInput[] };
      const result = await imagesToPdfImpl(images, emit);
      return { data: result, transfer: [result.buffer] };
    }
    case 'stampImage': {
      const { pdf, image, options } = payload as {
        pdf: Uint8Array;
        image: ImageInput;
        options: StampOptions;
      };
      const result = await stampImageImpl(pdf, image, options, emit);
      return { data: result, transfer: [result.buffer] };
    }
    case 'watermarkPdf': {
      const { pdf, text } = payload as { pdf: Uint8Array; text: string };
      const result = await watermarkPdfImpl(pdf, text, emit);
      return { data: result, transfer: [result.buffer] };
    }
    case 'addPageNumbers': {
      const { pdf, options } = payload as {
        pdf: Uint8Array;
        options: PageNumberOptions;
      };
      const result = await addPageNumbersImpl(pdf, options, emit);
      return { data: result, transfer: [result.buffer] };
    }
    case 'encryptPdf': {
      const { pdf, password, options } = payload as {
        pdf: Uint8Array;
        password: string;
        options?: EncryptOptions;
      };
      const result = await encryptPdfImpl(pdf, password, options, emit);
      return { data: result, transfer: [result.buffer] };
    }
    case 'decryptPdf': {
      const { pdf, password } = payload as { pdf: Uint8Array; password: string };
      const result = await decryptPdfImpl(pdf, password, emit);
      return { data: result, transfer: [result.buffer] };
    }
    case 'getMetadata': {
      const { pdf } = payload as { pdf: Uint8Array };
      return { data: await getPdfMetadataImpl(pdf), transfer: [] };
    }
    case 'setMetadata': {
      const { pdf, metadata } = payload as {
        pdf: Uint8Array;
        metadata: PdfMetadata;
      };
      const result = await setPdfMetadataImpl(pdf, metadata);
      return { data: result, transfer: [result.buffer] };
    }
    case 'getFormFields': {
      const { pdf } = payload as { pdf: Uint8Array };
      return { data: await getFormFieldsImpl(pdf), transfer: [] };
    }
    case 'fillForm': {
      const { pdf, values } = payload as {
        pdf: Uint8Array;
        values: Record<string, string>;
      };
      const result = await fillFormImpl(pdf, values);
      return { data: result, transfer: [result.buffer] };
    }
    default:
      throw new PdfEngineException(
        `Unsupported worker operation: ${operation}`,
        'WORKER_ERROR',
        operation
      );
  }
}
