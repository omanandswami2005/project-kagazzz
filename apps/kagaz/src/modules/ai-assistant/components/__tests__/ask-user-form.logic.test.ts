import { describe, expect, it } from 'vitest';
import { askUserSchema } from '../../types/ask-user';
import { documentsFor, initialValues, summarize, validate } from '../ask-user-form.logic';

const spec = askUserSchema.parse({
  question: 'How should I resize it?',
  fields: [
    { id: 'width', label: 'Width', type: 'number', min: 16, max: 8000, unit: 'px', default: 200 },
    { id: 'quality', label: 'Quality', type: 'choice', options: [{ value: 'low', label: 'Low' }, { value: 'high', label: 'High' }] },
    { id: 'tags', label: 'Tags', type: 'multi', required: false, options: [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }] },
  ],
});
const docs = [
  { id: 'doc-a', name: 'Rent.pdf', fileType: 'pdf' },
  { id: 'doc-c', name: 'Me.jpg', fileType: 'jpg' },
];

describe('ask-user form logic', () => {
  it('starts from defaults: number default, toggles off, multi/document empty', () => {
    expect(initialValues(spec)).toEqual({ width: 200, tags: [] });
    const withToggle = askUserSchema.parse({ question: 'q', fields: [{ id: 'on', label: 'On', type: 'toggle' }, { id: 'd', label: 'D', type: 'document' }] });
    expect(initialValues(withToggle)).toEqual({ on: false, d: [] });
  });

  it('validates required fields and numeric bounds', () => {
    expect(validate(spec, { width: 200 })).toEqual({ quality: { code: 'required' } });
    expect(validate(spec, { width: 5, quality: 'low' })).toEqual({ width: { code: 'min', min: 16 } });
    expect(validate(spec, { width: 9000, quality: 'low' })).toEqual({ width: { code: 'max', max: 8000 } });
    expect(validate(spec, { width: Number.NaN, quality: 'low' })).toEqual({ width: { code: 'invalid' } });
    expect(validate(spec, { width: 200, quality: 'high' })).toEqual({});
  });

  it('an optional field may stay empty; a required document field needs a selection', () => {
    const docSpec = askUserSchema.parse({ question: 'q', fields: [{ id: 'd', label: 'Doc', type: 'document' }] });
    expect(validate(docSpec, { d: [] })).toEqual({ d: { code: 'required' } });
    expect(validate(docSpec, { d: ['doc-a'] })).toEqual({});
  });

  it('checks date bounds as ISO strings', () => {
    const dateSpec = askUserSchema.parse({ question: 'q', fields: [{ id: 'when', label: 'When', type: 'date', minDate: '2026-01-01', maxDate: '2026-12-31' }] });
    expect(validate(dateSpec, { when: '2025-12-31' })).toHaveProperty('when.code', 'min');
    expect(validate(dateSpec, { when: '2027-01-01' })).toHaveProperty('when.code', 'max');
    expect(validate(dateSpec, { when: '2026-06-01' })).toEqual({});
  });

  it('summarizes with option labels, units and document ids (what the model reads next)', () => {
    expect(summarize(spec, { width: 200, quality: 'high', tags: ['a', 'b'] }, docs)).toBe(
      'Width: 200 px · Quality: High · Tags: Alpha, Beta'
    );
    expect(summarize(spec, { width: 200, quality: 'low', tags: [] }, docs)).toBe('Width: 200 px · Quality: Low');

    const other = askUserSchema.parse({
      question: 'q',
      fields: [
        { id: 'photo', label: 'Photo', type: 'document' },
        { id: 'stamp', label: 'Stamp', type: 'toggle' },
      ],
    });
    expect(summarize(other, { photo: ['doc-c'], stamp: true }, docs)).toBe('Photo: "Me.jpg" (id doc-c) · Stamp: yes');
    expect(summarize(other, { photo: ['gone'], stamp: false }, docs)).toBe('Photo: (id gone) · Stamp: no');
  });

  it('filters document choices by kind', () => {
    const field = (kinds?: ('pdf' | 'image')[]) => askUserSchema.parse({ question: 'q', fields: [{ id: 'd', label: 'D', type: 'document', kinds }] }).fields[0];
    expect(documentsFor(field(['pdf']), docs).map((d) => d.id)).toEqual(['doc-a']);
    expect(documentsFor(field(['image']), docs).map((d) => d.id)).toEqual(['doc-c']);
    expect(documentsFor(field(), docs)).toHaveLength(2);
  });
});
