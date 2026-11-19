/**
 * ST-5: measures what compressing each large PDF would save — a dry run of
 * the real compressor at the recommended quality, one file at a time, on
 * demand (it renders every page, so it never runs by itself on page load).
 * Nothing is saved; the numbers live only on this screen.
 */
import { useCallback, useState } from 'react';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { log } from '@/core/logging';
import { usePdfEngine } from '@/modules/pdf-engine/hooks/usePdfEngine';

/** Below this share of the file, compressing isn't worth suggesting. */
export const MIN_WORTHWHILE_SAVING = 0.1;

/** What {@link useCompressionEstimates} exposes. */
export interface CompressionEstimates {
  /** Bytes each PDF would save (0 = not worth it), keyed by document id. */
  savings: ReadonlyMap<string, number>;
  /** 1-based index of the file being measured, or 0 when idle. */
  checking: number;
  run: (pdfs: DocumentEntity[]) => Promise<void>;
}

/** On-demand "how much would compressing save?" for a list of PDFs. */
export function useCompressionEstimates(): CompressionEstimates {
  const engine = usePdfEngine();
  const [savings, setSavings] = useState<ReadonlyMap<string, number>>(new Map());
  const [checking, setChecking] = useState(0);

  const run = useCallback(
    async (pdfs: DocumentEntity[]): Promise<void> => {
      const next = new Map<string, number>();
      for (const [i, doc] of pdfs.entries()) {
        setChecking(i + 1);
        try {
          const after = await engine.estimateCompressedSize(doc, 'medium');
          const saved = doc.fileSize - after;
          next.set(doc.id, saved / doc.fileSize >= MIN_WORTHWHILE_SAVING ? saved : 0);
        } catch (err: unknown) {
          // A PDF that can't be compressed (encrypted, damaged) just isn't suggested.
          next.set(doc.id, 0);
          log('document-vault').warn({ event: 'vault.storage.estimate_failed', err: { message: String(err) } });
        }
        setSavings(new Map(next));
      }
      setChecking(0);
    },
    [engine]
  );

  return { savings, checking, run };
}
