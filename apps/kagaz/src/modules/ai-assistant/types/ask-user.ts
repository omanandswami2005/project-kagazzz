/**
 * The form the model can put in front of the user (`ai.askUser`, the chat's
 * GenUI). Deliberately a flat object with a `type` enum, not a tagged union:
 * simple JSON Schema is the subset every function-calling model (Gemma,
 * Gemini) handles reliably. Type-specific requirements are checked here, not
 * in the schema the model sees.
 *
 * [SEC] Model-written text — rendered as plain text only, capped in count and
 * length, and fields that look like they collect secrets are refused.
 */
import { z } from 'zod';

export const FIELD_TYPES = ['choice', 'multi', 'number', 'text', 'toggle', 'date', 'document'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

const optionSchema = z.object({
  value: z.string().min(1).max(60),
  label: z.string().min(1).max(80),
});

const fieldSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,30}$/, 'id must be a short identifier like "quality"'),
    label: z.string().min(1).max(100),
    type: z.enum(FIELD_TYPES),
    required: z.boolean().default(true),
    /** choice / multi: the options to pick from (2–8). */
    options: z.array(optionSchema).min(2).max(8).optional(),
    /** number: bounds, step and a unit shown next to the value (e.g. "KB"). */
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().positive().optional(),
    unit: z.string().max(12).optional(),
    /** number: pre-filled value. */
    default: z.number().optional(),
    /** text: hint and length cap. */
    placeholder: z.string().max(80).optional(),
    maxLength: z.number().int().min(1).max(200).optional(),
    /** date: ISO yyyy-mm-dd bounds. */
    minDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    maxDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    /** document: allow several, and restrict the kinds shown. */
    multiple: z.boolean().optional(),
    kinds: z.array(z.enum(['pdf', 'image'])).max(2).optional(),
  })
  .superRefine((field, ctx) => {
    if ((field.type === 'choice' || field.type === 'multi') && !field.options) {
      ctx.addIssue({ code: 'custom', message: `${field.type} fields need options (2-8)`, path: ['options'] });
    }
    if (field.type === 'number' && field.min !== undefined && field.max !== undefined && field.min > field.max) {
      ctx.addIssue({ code: 'custom', message: 'min must not exceed max', path: ['min'] });
    }
  });

export const askUserSchema = z
  .object({
    question: z.string().min(1).max(300),
    fields: z.array(fieldSchema).min(1).max(3),
  })
  .superRefine((spec, ctx) => {
    const ids = spec.fields.map((f) => f.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: 'custom', message: 'field ids must be unique', path: ['fields'] });
    }
  });

export type AskUserField = z.infer<typeof fieldSchema>;
export type AskUserSpec = z.infer<typeof askUserSchema>;

/** What the user answered, keyed by field id. Document fields hold document ids. */
export type AnswerValue = string | number | boolean | string[];
export type AnswerValues = Record<string, AnswerValue>;

const SENSITIVE = /pass(word|code)|\botp\b|\bpin\b|\bcvv\b|\bpuk\b|aadhaar|aadhar|\bpan\b.*(number|no)|(card|account)\s*(number|no)|\bssn\b|secret|biometric/i;

/** The first field or question that asks for a secret/ID number, or null — the form is refused, not rendered. */
export function findSensitiveRequest(spec: AskUserSpec): string | null {
  const texts = [spec.question, ...spec.fields.flatMap((f) => [f.label, f.placeholder ?? '', ...(f.options ?? []).map((o) => o.label)])];
  return texts.find((t) => SENSITIVE.test(t)) ?? null;
}
