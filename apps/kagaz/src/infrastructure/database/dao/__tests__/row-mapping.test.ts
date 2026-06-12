import { describe, expect, it } from 'vitest';
import {
  asBool,
  asNumber,
  asOptionalNumber,
  asOptionalString,
  asString,
  newId,
  nowIso,
} from '../row-mapping';

describe('row-mapping', () => {
  it('asString returns strings and throws on anything else', () => {
    expect(asString({ a: 'x' }, 'a')).toBe('x');
    expect(() => asString({ a: 1 }, 'a')).toThrow('column "a"');
    expect(() => asString({}, 'a')).toThrow('column "a"');
  });

  it('asOptionalString maps NULL/missing to undefined', () => {
    expect(asOptionalString({ a: 'x' }, 'a')).toBe('x');
    expect(asOptionalString({ a: null }, 'a')).toBeUndefined();
    expect(asOptionalString({}, 'a')).toBeUndefined();
    expect(() => asOptionalString({ a: 5 }, 'a')).toThrow('column "a"');
  });

  it('asNumber returns numbers and throws on anything else', () => {
    expect(asNumber({ n: 42 }, 'n')).toBe(42);
    expect(() => asNumber({ n: '42' }, 'n')).toThrow('column "n"');
  });

  it('asOptionalNumber maps NULL/missing to undefined', () => {
    expect(asOptionalNumber({ n: 7 }, 'n')).toBe(7);
    expect(asOptionalNumber({ n: null }, 'n')).toBeUndefined();
    expect(asOptionalNumber({}, 'n')).toBeUndefined();
    expect(() => asOptionalNumber({ n: 'x' }, 'n')).toThrow('column "n"');
  });

  it('asBool treats 1/true as true, everything else as false', () => {
    expect(asBool({ b: 1 }, 'b')).toBe(true);
    expect(asBool({ b: true }, 'b')).toBe(true);
    expect(asBool({ b: 0 }, 'b')).toBe(false);
    expect(asBool({ b: null }, 'b')).toBe(false);
  });

  it('newId returns unique UUIDs', () => {
    expect(newId()).not.toBe(newId());
    expect(newId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('nowIso returns an ISO 8601 timestamp', () => {
    const val = nowIso();
    expect(new Date(val).toISOString()).toBe(val);
  });
});
