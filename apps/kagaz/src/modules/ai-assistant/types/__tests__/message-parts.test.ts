import { describe, expect, it } from 'vitest';
import { askUserSchema, findSensitiveRequest } from '../ask-user';
import { answeredFormIds, parseParts, serializeParts, toModelText } from '../message-parts';

const doc = { id: 'doc-a', name: 'Rent agreement.pdf', fileType: 'pdf' };

describe('message parts', () => {
  it('round-trips through JSON and treats corrupt or invalid parts as no parts', () => {
    const json = serializeParts([{ type: 'attachments', documents: [doc] }]);
    expect(parseParts(json)).toEqual([{ type: 'attachments', documents: [doc] }]);
    expect(serializeParts([])).toBeUndefined();
    expect(parseParts(undefined)).toEqual([]);
    expect(parseParts('not json')).toEqual([]);
    expect(parseParts('[{"type":"attachments","documents":"nope"}]')).toEqual([]);
    expect(parseParts('[{"type":"surprise"}]')).toEqual([]);
  });

  it('toModelText adds metadata-only attachment lines with ids, identically for sends and replays', () => {
    const partsJson = serializeParts([{ type: 'attachments', documents: [doc, { id: 'doc-c', name: 'Photo.jpg', fileType: 'jpg' }] }]);
    expect(toModelText({ content: 'compress these', partsJson })).toBe(
      'compress these\n[Attached: "Rent agreement.pdf" (id doc-a, pdf)]\n[Attached: "Photo.jpg" (id doc-c, jpg)]'
    );
    expect(toModelText({ content: 'hello' })).toBe('hello');
    expect(toModelText({ partsJson })).toContain('[Attached: "Rent agreement.pdf"');
  });

  it('answeredFormIds finds which forms already have an answer', () => {
    const answered = serializeParts([{ type: 'answer', formId: 'f1' }]);
    const open = serializeParts([{ type: 'form', formId: 'f2', spec: { question: 'q', fields: [{ id: 'a', label: 'A', type: 'toggle', required: true }] } }]);
    expect(answeredFormIds([{ partsJson: answered }, { partsJson: open }, {}])).toEqual(new Set(['f1']));
  });
});

describe('askUserSchema', () => {
  const ok = {
    question: 'How should I resize it?',
    fields: [
      { id: 'width', label: 'Width', type: 'number', min: 16, max: 8000, unit: 'px' },
      { id: 'quality', label: 'Quality', type: 'choice', options: [{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }] },
    ],
  };

  it('accepts a valid form and fills the default for `required`', () => {
    const parsed = askUserSchema.parse(ok);
    expect(parsed.fields[0].required).toBe(true);
  });

  it.each([
    ['no fields', { ...ok, fields: [] }],
    ['more than 3 fields', { ...ok, fields: Array.from({ length: 4 }, (_, i) => ({ id: `f${i}`, label: 'x', type: 'toggle' })) }],
    ['choice without options', { ...ok, fields: [{ id: 'q', label: 'Q', type: 'choice' }] }],
    ['a single option', { ...ok, fields: [{ id: 'q', label: 'Q', type: 'choice', options: [{ value: 'a', label: 'A' }] }] }],
    ['duplicate ids', { ...ok, fields: [{ id: 'a', label: 'A', type: 'toggle' }, { id: 'a', label: 'B', type: 'toggle' }] }],
    ['min above max', { ...ok, fields: [{ id: 'n', label: 'N', type: 'number', min: 10, max: 1 }] }],
    ['an unknown field type', { ...ok, fields: [{ id: 'n', label: 'N', type: 'password' }] }],
    ['a bad id', { ...ok, fields: [{ id: '1 bad', label: 'N', type: 'toggle' }] }],
  ])('rejects %s', (_name, spec) => {
    expect(askUserSchema.safeParse(spec).success).toBe(false);
  });

  it('refuses forms that ask for secrets or ID numbers, but not ordinary ones', () => {
    const ask = (label: string) => askUserSchema.parse({ question: 'q', fields: [{ id: 'a', label, type: 'text' }] });
    for (const bad of ['Your password', 'Enter OTP', 'Aadhaar number', 'Card number', 'PAN number', 'Account number', 'CVV']) {
      expect(findSensitiveRequest(ask(bad)), bad).not.toBeNull();
    }
    for (const fine of ['Watermark text', 'Width', 'Which page range?', 'Pan the camera']) {
      expect(findSensitiveRequest(ask(fine)), fine).toBeNull();
    }
    expect(findSensitiveRequest({ question: 'What is your passcode?', fields: ask('x').fields })).not.toBeNull();
  });
});
