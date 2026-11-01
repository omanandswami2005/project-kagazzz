/**
 * The chat's GenUI form (`ai.askUser`): one card with 1–3 fields the model
 * asked for. Everything the model wrote is rendered as plain text; inputs are
 * native controls with visible labels. Submitting sends a readable summary as
 * the user's next message (see ask-user-form.logic.ts).
 */
import type { TFunction } from 'i18next';
import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Toggle } from '@kagaz/ui';
import { PdfDocPicker } from '@/modules/pdf-engine/components/PdfDocPicker';
import type { DocumentEntity } from '@/infrastructure/database/types';
import type { AnswerValue, AnswerValues, AskUserField, AskUserSpec } from '../types/ask-user';
import { documentsFor, initialValues, summarize, validate, type FieldError } from './ask-user-form.logic';

export interface AskUserFormProps {
  spec: AskUserSpec;
  /** Unlocked vault documents, for `document` fields. */
  documents: DocumentEntity[];
  disabled?: boolean;
  /** Called with the readable summary and the raw values. */
  onSubmit: (summary: string, values: AnswerValues) => void;
}

export function AskUserForm({ spec, documents, disabled, onSubmit }: AskUserFormProps): ReactNode {
  const { t } = useTranslation('ai-assistant');
  const formId = useId();
  const [values, setValues] = useState<AnswerValues>(() => initialValues(spec));
  const [errors, setErrors] = useState<Record<string, FieldError>>({});

  const set = (id: string, value: AnswerValue | undefined): void =>
    setValues((prev) => {
      const next = { ...prev };
      if (value === undefined) {
        delete next[id];
      } else {
        next[id] = value;
      }
      return next;
    });

  const errorText = (error: FieldError | undefined): string | null => {
    if (!error) {
      return null;
    }
    switch (error.code) {
      case 'required':
        return t('form.errors.required');
      case 'min':
        return t('form.errors.min', { min: error.min });
      case 'max':
        return t('form.errors.max', { max: error.max });
      default:
        return t('form.errors.invalid');
    }
  };

  const submit = (event: React.FormEvent): void => {
    event.preventDefault();
    const found = validate(spec, values);
    setErrors(found);
    if (Object.keys(found).length === 0) {
      onSubmit(summarize(spec, values, documents), values);
    }
  };

  return (
    <form className="kg-chat__form" onSubmit={submit} noValidate data-agent-id="ai.chat.form">
      {spec.fields.map((field) => {
        const inputId = `${formId}-${field.id}`;
        const error = errorText(errors[field.id]);
        return (
          <div key={field.id} className="kg-chat__form-field" data-agent-id={`ai.chat.form-field-${field.id}`}>
            {renderField({ field, inputId, value: values[field.id], set, disabled, documents, t })}
            {error && (
              <p className="kg-chat__form-error" role="alert">
                {error}
              </p>
            )}
          </div>
        );
      })}
      <Button type="submit" variant="primary" size="sm" disabled={disabled} agentId="ai.chat.form-submit">
        {t('form.submit')}
      </Button>
    </form>
  );
}

interface FieldRenderProps {
  field: AskUserField;
  inputId: string;
  value: AnswerValue | undefined;
  set: (id: string, value: AnswerValue | undefined) => void;
  disabled?: boolean;
  documents: DocumentEntity[];
  t: TFunction<'ai-assistant'>;
}

function renderField({ field, inputId, value, set, disabled, documents, t }: FieldRenderProps): ReactNode {
  const required = field.required ? <span aria-hidden> *</span> : null;
  switch (field.type) {
    case 'choice':
    case 'multi': {
      const multi = field.type === 'multi';
      const selected = multi ? ((value as string[] | undefined) ?? []) : value;
      return (
        <fieldset className="kg-chat__form-group" disabled={disabled}>
          <legend>
            {field.label}
            {required}
          </legend>
          <div className="kg-chat__form-options" role={multi ? 'group' : 'radiogroup'}>
            {(field.options ?? []).map((option) => {
              const on = multi ? (selected as string[]).includes(option.value) : selected === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className="kg-chat__form-option"
                  role={multi ? undefined : 'radio'}
                  aria-checked={multi ? undefined : on}
                  aria-pressed={multi ? on : undefined}
                  data-agent-id={`ai.chat.form-option-${field.id}-${option.value}`}
                  data-agent-state={on ? 'selected' : 'idle'}
                  onClick={() =>
                    multi
                      ? set(field.id, on ? (selected as string[]).filter((v) => v !== option.value) : [...(selected as string[]), option.value])
                      : set(field.id, option.value)
                  }
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      );
    }
    case 'toggle':
      return (
        <Toggle
          enabled={Boolean(value)}
          onChange={(on) => set(field.id, on)}
          label={field.label}
          disabled={disabled}
          agentId={`ai.chat.form-toggle-${field.id}`}
        />
      );
    case 'document': {
      const choices = documentsFor(field, documents);
      return (
        <fieldset className="kg-chat__form-group" disabled={disabled}>
          <legend>
            {field.label}
            {required}
          </legend>
          <PdfDocPicker
            documents={choices}
            multi={Boolean(field.multiple)}
            selectedIds={(value as string[] | undefined) ?? []}
            onChange={(ids) => set(field.id, ids)}
            emptyText={t('form.no_documents')}
            idPrefix={`ai.chat.form-docs-${field.id}`}
          />
        </fieldset>
      );
    }
    default: {
      const isNumber = field.type === 'number';
      return (
        <div className="kg-chat__form-input">
          <label htmlFor={inputId}>
            {field.label}
            {field.unit ? ` (${field.unit})` : ''}
            {required}
          </label>
          <input
            id={inputId}
            type={isNumber ? 'number' : field.type === 'date' ? 'date' : 'text'}
            inputMode={isNumber ? 'decimal' : undefined}
            min={isNumber ? field.min : field.minDate}
            max={isNumber ? field.max : field.maxDate}
            step={isNumber ? (field.step ?? 'any') : undefined}
            maxLength={field.type === 'text' ? (field.maxLength ?? 200) : undefined}
            placeholder={field.placeholder}
            disabled={disabled}
            value={value === undefined ? '' : String(value)}
            data-agent-id={`ai.chat.form-input-${field.id}`}
            onChange={(e) => {
              const raw = e.target.value;
              set(field.id, raw === '' ? undefined : isNumber ? Number(raw) : raw);
            }}
          />
        </div>
      );
    }
  }
}
