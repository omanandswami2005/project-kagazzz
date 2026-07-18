import { describe, expect, it } from 'vitest';
import { REDACT_PATHS, REDACTION_CENSOR, redactRecord } from '../redaction';

describe('redactRecord ([SEC] 14-observability §7)', () => {
  it('redacts every denylisted key at the top level', () => {
    const input = {
      password: 'hunter2',
      pin: '1234',
      secret: 's',
      key: 'k',
      token: 't',
      ocrText: 'extracted text',
      content: 'doc bytes',
      aadhaar: '1234-5678-9012',
      pan: 'ABCDE1234F',
      messages: ['hi'],
      filePathAbsolute: 'C:/Users/x/doc.pdf',
      quickReferenceLabel: 'PAN No',
      quickReferenceValue: 'ABCDE1234F',
      event: 'vault.upload.success',
    };
    const out = redactRecord(input);
    for (const field of [
      'password',
      'pin',
      'secret',
      'key',
      'token',
      'ocrText',
      'content',
      'aadhaar',
      'pan',
      'messages',
      'filePathAbsolute',
      'quickReferenceLabel',
      'quickReferenceValue',
    ] as const) {
      expect(out[field]).toBe(REDACTION_CENSOR);
    }
    expect(out.event).toBe('vault.upload.success');
  });

  it('redacts nested keys at any depth (the *. wildcard)', () => {
    const out = redactRecord({
      ctx: { user: { aadhaar: 'x' }, doc: { ocrText: 'y' } },
      list: [{ password: 'p' }],
    });
    expect(out.ctx.user.aadhaar).toBe(REDACTION_CENSOR);
    expect(out.ctx.doc.ocrText).toBe(REDACTION_CENSOR);
    expect(out.list[0]?.password).toBe(REDACTION_CENSOR);
  });

  it('never mutates the input', () => {
    const input = { password: 'p', nested: { pan: 'x' } };
    redactRecord(input);
    expect(input.password).toBe('p');
    expect(input.nested.pan).toBe('x');
  });

  it('passes primitives and null through', () => {
    expect(redactRecord(null)).toBeNull();
    expect(redactRecord(42)).toBe(42);
    expect(redactRecord('ok')).toBe('ok');
  });

  it('is cycle-safe via the depth cap', () => {
    const a: Record<string, unknown> = {};
    a['self'] = a;
    expect(() => redactRecord(a)).not.toThrow();
  });

  it('the denylist covers every spec §7 category', () => {
    const joined = REDACT_PATHS.join(' ');
    for (const required of [
      'password',
      'pin',
      'secret',
      'key',
      'token',
      'ocrText',
      'content',
      'aadhaar',
      'pan',
      'messages',
      'filePathAbsolute',
      'quickReferenceLabel',
      'quickReferenceValue',
    ]) {
      expect(joined).toContain(required);
    }
  });
});
