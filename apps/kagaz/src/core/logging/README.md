# core/logging

Logging infrastructure (P0-11). Spec: [14-observability-logging.md](../../../../../docs/architecture/14-observability-logging.md) · `[SEC]` `[LEGAL]`.

**The one idiom** (never `console.log` — ESLint errors on it):

```ts
import { log } from '@/core/logging';

const logger = log('pdf-engine');                       // module is mandatory
logger.info({ event: 'pdf.merge.start', opId, fileCount });   // event-name first
logger.error({ event: 'pdf.merge.failed', opId, err }, 'merge failed');
```

| File | Purpose |
|---|---|
| `logger.ts` | `rootLogger` + `log(module)` children; dev console stream; transmit → sink (queued until `setDiagnosticSink`) |
| `redaction.ts` | Central denylist — **pino's `redact` is a no-op in browser builds**, so `redactRecord` runs on every record before any sink/console |
| `diagnostic-sink.ts` | Batched `app_logs` ring buffer (2s/50 records; 7-day/5MB launch prune) inside the SQLCipher DB |
| `audit-log.dao.ts` | Append-only, SHA-256 hash-chained `audit_logs` (DPDP legal evidence; no update/delete methods exist) |
| `worker-relay.ts` | Workers post records to the main thread (single-writer rule); `opId` correlates cross-thread traces |

Wiring (P0-10 bootstrap): open DB → `new DiagnosticSink(db)` → `sink.pruneOnLaunch()` → `setDiagnosticSink(sink)`; error boundaries log `fatal`. Never log: keys/passwords/PINs, document content/OCR text, Aadhaar/PAN, absolute paths, AI conversation text (§7).
