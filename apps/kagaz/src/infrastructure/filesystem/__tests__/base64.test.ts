import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from '../base64';

describe('base64 helpers', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 255, 37, 80, 68, 70]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('round-trips data larger than the chunk size', () => {
    const big = new Uint8Array(0x8000 * 2 + 17);
    for (let i = 0; i < big.length; i += 1) {
      big[i] = i % 256;
    }
    expect(base64ToBytes(bytesToBase64(big))).toEqual(big);
  });

  it('handles empty input', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('');
    expect(base64ToBytes('')).toEqual(new Uint8Array(0));
  });

  it('produces standard base64 ("%PDF" → "JVBERg==")', () => {
    expect(bytesToBase64(new Uint8Array([0x25, 0x50, 0x44, 0x46]))).toBe(
      'JVBERg=='
    );
  });
});
