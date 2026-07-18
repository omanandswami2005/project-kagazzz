import { describe, expect, it } from 'vitest';
import {
  detectFormat,
  detectFormatFromBytes,
} from '../format-detector';

/** Builds a 16-byte header from (offset → bytes) signature fragments. */
function header(...frags: [number, number[]][]): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(16);
  for (const [offset, sig] of frags) {
    bytes.set(sig, offset);
  }
  return bytes;
}

const ascii = (s: string): number[] => [...s].map((c) => c.charCodeAt(0));

describe('detectFormatFromBytes (F-8 §5.3)', () => {
  it('recognises each format from its magic bytes', () => {
    expect(detectFormatFromBytes(header([0, [0xff, 0xd8, 0xff]]))).toBe('jpeg');
    expect(detectFormatFromBytes(header([0, [0x89, 0x50, 0x4e, 0x47]]))).toBe(
      'png'
    );
    expect(
      detectFormatFromBytes(
        header([0, ascii('RIFF')], [8, ascii('WEBP')])
      )
    ).toBe('webp');
    expect(detectFormatFromBytes(header([0, ascii('GIF8')]))).toBe('gif');
    expect(detectFormatFromBytes(header([0, ascii('BM')]))).toBe('bmp');
    expect(detectFormatFromBytes(header([0, [0x49, 0x49, 0x2a, 0x00]]))).toBe(
      'tiff'
    );
    expect(detectFormatFromBytes(header([0, [0x4d, 0x4d, 0x00, 0x2a]]))).toBe(
      'tiff'
    );
    expect(
      detectFormatFromBytes(header([4, ascii('ftyp')], [8, ascii('heic')]))
    ).toBe('heic');
  });

  it('does not mistake a RIFF that is not WebP (e.g. WAV)', () => {
    expect(
      detectFormatFromBytes(header([0, ascii('RIFF')], [8, ascii('WAVE')]))
    ).toBeNull();
  });

  it('returns null for an unrecognised header', () => {
    expect(detectFormatFromBytes(header([0, [0x00, 0x01, 0x02, 0x03]]))).toBeNull();
  });

  it('is safe on a short buffer', () => {
    expect(detectFormatFromBytes(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });

  it('reads the header off a Blob', async () => {
    const blob = new Blob([header([0, [0x89, 0x50, 0x4e, 0x47]])]);
    expect(await detectFormat(blob)).toBe('png');
  });
});
