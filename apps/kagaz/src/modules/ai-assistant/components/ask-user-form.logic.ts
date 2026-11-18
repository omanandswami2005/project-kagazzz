/**
 * Pure logic behind the chat's GenUI form: starting values, validation and the
 * readable summary sent back to the model as the user's next message. No React,
 * so every rule is unit-tested directly.
 */
import type { AnswerValue, AnswerValues, AskUserField, AskUserSpec } from '../types/ask-user';

export interface FieldDoc {
  id: string;
  name: string;
  fileType: string;
}

export type FieldError = { code: 'required' } | { code: 'min'; min: number } | { code: 'max'; max: number } | { code: 'invalid' };

const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'webp', 'heic', 'tiff']);

/** Documents a `document` field may offer, by its `kinds` filter (none = all). */
export function documentsFor<T extends FieldDoc>(field: AskUserField, documents: T[]): T[] {
  if (!field.kinds || field.kinds.length === 0) {
    return documents;
  }
  return documents.filter((d) => {
    const type = d.fileType.toLowerCase();
    return (field.kinds?.includes('pdf') && type === 'pdf') || (field.kinds?.includes('image') && IMAGE_TYPES.has(type));
  });
}

export function initialValues(spec: AskUserSpec): AnswerValues {
  const values: AnswerValues = {};
  for (const field of spec.fields) {
    if (field.type === 'number' && field.default !== undefined) {
      values[field.id] = field.default;
    } else if (field.type === 'toggle') {
      values[field.id] = false;
    } else if (field.type === 'multi' || field.type === 'document') {
      values[field.id] = [];
    }
  }
  return values;
}

const isEmpty = (value: AnswerValue | undefined): boolean =>
  value === undefined || value === '' || (Array.isArray(value) && value.length === 0);

/** Errors by field id; an empty object means the form can be submitted. */
export function validate(spec: AskUserSpec, values: AnswerValues): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {};
  for (const field of spec.fields) {
    const value = values[field.id];
    if (field.type === 'toggle') {
      continue; // a toggle always has a value
    }
    if (isEmpty(value)) {
      if (field.required) {
        errors[field.id] = { code: 'required' };
      }
      continue;
    }
    if (field.type === 'number') {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        errors[field.id] = { code: 'invalid' };
      } else if (field.min !== undefined && value < field.min) {
        errors[field.id] = { code: 'min', min: field.min };
      } else if (field.max !== undefined && value > field.max) {
        errors[field.id] = { code: 'max', max: field.max };
      }
    }
    if (field.type === 'date' && typeof value === 'string') {
      if (field.minDate && value < field.minDate) {
        errors[field.id] = { code: 'min', min: 0 };
      } else if (field.maxDate && value > field.maxDate) {
        errors[field.id] = { code: 'max', max: 0 };
      }
    }
  }
  return errors;
}

/**
 * "Width: 200 px · Quality: High · Photo: "Me.jpg" (id doc-c)". Document ids
 * are included (metadata only) so the model can act without asking again.
 */
export function summarize(spec: AskUserSpec, values: AnswerValues, documents: FieldDoc[]): string {
  const parts: string[] = [];
  for (const field of spec.fields) {
    const value = values[field.id];
    if (isEmpty(value) && field.type !== 'toggle') {
      continue;
    }
    parts.push(`${field.label}: ${describe(field, value, documents)}`);
  }
  return parts.join(' · ');
}

function describe(field: AskUserField, value: AnswerValue | undefined, documents: FieldDoc[]): string {
  const optionLabel = (v: string): string => field.options?.find((o) => o.value === v)?.label ?? v;
  switch (field.type) {
    case 'choice':
      return optionLabel(String(value));
    case 'multi':
      return (value as string[]).map(optionLabel).join(', ');
    case 'number':
      return field.unit ? `${String(value)} ${field.unit}` : String(value);
    case 'toggle':
      return value ? 'yes' : 'no';
    case 'document':
      return (value as string[])
        .map((id) => {
          const doc = documents.find((d) => d.id === id);
          return doc ? `"${doc.name}" (id ${doc.id})` : `(id ${id})`;
        })
        .join(', ');
    default:
      return String(value);
  }
}
