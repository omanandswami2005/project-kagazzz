// Run the PDF engine contract against the REAL worker-backed service.
// @vitest/web-worker polyfills Worker so the actual pdf-manipulation /
// pdf-compress workers (and the real pdf-lib / pdf-compress ops they call)
// execute in-process — no mock implementation.
//
// `clone: 'ponyfill'` deep-copies postMessage payloads instead of honouring
// the transfer list. The service transfers ArrayBuffers (zero-copy, correct on
// a real device); in a single-realm test that transfer would *detach* the
// buffer before the worker reads it, so we copy instead.
import { defineWebWorkers } from '@vitest/web-worker/pure';
import { pdfEngineContract } from '../types/__contract__/pdf-engine.contract';
import { PdfEngineServiceImpl } from '../services/pdf-engine.service';

defineWebWorkers({ clone: 'ponyfill' });

pdfEngineContract(async () => new PdfEngineServiceImpl());
