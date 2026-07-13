import { describe, expect, it } from 'vitest';
import { buildWordFromText } from '../pdf-to-word-ops';

/** Reads the first bytes of a Blob as a Uint8Array. */
async function headBytes(blob: Blob, n: number): Promise<Uint8Array> {
  return new Uint8Array(await blob.slice(0, n).arrayBuffer());
}

describe('buildWordFromText (F-41)', () => {
  it('produces a non-empty .docx (ZIP) Blob', async () => {
    const blob = await buildWordFromText('Aadhaar', 'Line one\nLine two');
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
    // A .docx is an Office Open XML ZIP — the "PK\x03\x04" local-file header.
    const header = await headBytes(blob, 4);
    expect(Array.from(header)).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('handles empty text without throwing', async () => {
    const blob = await buildWordFromText('Empty', '');
    expect(blob.size).toBeGreaterThan(0);
  });
});
