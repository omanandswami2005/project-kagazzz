import { compress } from '@quicktoolsone/pdf-compress';
import { loadAndValidatePdf } from './pdf-ops';
import {
  type CompressionLevel,
  type ProgressCallback,
  PdfEngineException,
} from '../types/pdf-engine.types';

/**
 * Compresses a PDF to reduce file size using @quicktoolsone/pdf-compress.
 */
export async function compressPdfImpl(
  pdf: Uint8Array,
  quality: CompressionLevel,
  onProgress?: ProgressCallback
): Promise<Uint8Array> {
  const op = 'compressPdf';

  // Load and validate using pdf-lib to check validity before compression.
  await loadAndValidatePdf(pdf, op);

  let preset: 'lossless' | 'balanced' | 'max';
  switch (quality) {
    case 'high':
      preset = 'lossless';
      break;
    case 'medium':
      preset = 'balanced';
      break;
    case 'low':
      preset = 'max';
      break;
    default:
      preset = 'balanced';
  }

  // Pass exactly the PDF bytes: a Uint8Array can be a view into a larger
  // buffer, so only hand over `.buffer` directly when it's a tight fit;
  // otherwise copy out the precise slice.
  const input =
    pdf.byteOffset === 0 && pdf.byteLength === pdf.buffer.byteLength
      ? (pdf.buffer as ArrayBuffer)
      : pdf.slice().buffer;

  try {
    const result = await compress(input, {
      preset,
      onProgress: (event) => {
        if (onProgress) {
          onProgress({
            operationId: 'compress',
            operation: op,
            percent: event.progress,
            message: `Compression phase: ${event.phase}${
              event.message ? ` - ${event.message}` : ''
            }`,
            currentStep: event.currentChunk,
            totalSteps: event.totalChunks,
          });
        }
      },
    });

    if (onProgress) {
      onProgress({
        operationId: 'compress',
        operation: op,
        percent: 100,
        message: 'Done',
      });
    }

    return new Uint8Array(result.pdf);
  } catch (e: unknown) {
    const error = e instanceof Error ? e : new Error(String(e));
    throw new PdfEngineException(
      `Compression failed: ${error.message}`,
      'COMPRESSION_FAILED',
      op,
      error
    );
  }
}
