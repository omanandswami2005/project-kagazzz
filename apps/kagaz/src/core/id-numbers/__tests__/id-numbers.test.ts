import { describe, expect, it } from 'vitest';
import { detectIdNumbers, isAlreadySaved, isVerhoeffValid, maskAadhaar } from '..';

// 2341 2341 2346 passes Verhoeff (generated for tests; not a real person's number).
const VALID = '234123412346';

describe('id-numbers', () => {
  it('validates the Verhoeff checksum', () => {
    expect(isVerhoeffValid(VALID)).toBe(true);
    expect(isVerhoeffValid('234123412347')).toBe(false);
  });

  it('finds PAN and checksum-valid Aadhaar, ignores other 12-digit runs', () => {
    expect(
      detectIdNumbers(`PAN: abcpe1234f\nUID 2341 2341 2346\nA/C 234123412347`)
    ).toEqual([
      { kind: 'pan', value: 'ABCPE1234F' },
      { kind: 'aadhaar', value: '2341 2341 2346' },
    ]);
    expect(detectIdNumbers('')).toEqual([]);
  });

  it('masks Aadhaar to the last 4 digits', () => {
    expect(maskAadhaar('2341 2341 2346')).toBe('XXXX XXXX 2346');
  });

  it('knows when an ID is already saved, including a masked Aadhaar', () => {
    expect(isAlreadySaved({ kind: 'pan', value: 'ABCPE1234F' }, ['abcpe1234f'])).toBe(true);
    expect(isAlreadySaved({ kind: 'aadhaar', value: '2341 2341 2346' }, ['XXXX XXXX 2346'])).toBe(true);
    expect(isAlreadySaved({ kind: 'aadhaar', value: '2341 2341 2346' }, ['9999'])).toBe(false);
  });
});
