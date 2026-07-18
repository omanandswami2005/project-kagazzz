import {
  PDFCheckBox,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from 'pdf-lib';
import { loadAndValidatePdf } from './pdf-ops';
import { type FormField, PdfEngineException } from '../types/pdf-engine.types';

/** Truthy string values that check a checkbox. */
const CHECKED = new Set(['true', 'on', 'yes', '1', 'checked']);

/** Reads the fillable form fields from `pdf` (F-28). */
export async function getFormFieldsImpl(pdf: Uint8Array): Promise<FormField[]> {
  const op = 'getFormFields';
  const doc = await loadAndValidatePdf(pdf, op);
  const form = doc.getForm();

  return form.getFields().map((field): FormField => {
    const name = field.getName();
    if (field instanceof PDFTextField) {
      return { name, type: 'text', value: field.getText() ?? '' };
    }
    if (field instanceof PDFCheckBox) {
      return { name, type: 'checkbox', value: String(field.isChecked()) };
    }
    if (field instanceof PDFDropdown) {
      return {
        name,
        type: 'dropdown',
        value: field.getSelected()[0] ?? '',
        options: field.getOptions(),
      };
    }
    if (field instanceof PDFOptionList) {
      return {
        name,
        type: 'optionlist',
        value: field.getSelected().join(', '),
        options: field.getOptions(),
      };
    }
    if (field instanceof PDFRadioGroup) {
      return {
        name,
        type: 'radio',
        value: field.getSelected() ?? '',
        options: field.getOptions(),
      };
    }
    return { name, type: 'button', value: '' };
  });
}

/** Fills `values` (by field name) into the form and flattens it (F-28). */
export async function fillFormImpl(
  pdf: Uint8Array,
  values: Record<string, string>
): Promise<Uint8Array> {
  const op = 'fillForm';
  const doc = await loadAndValidatePdf(pdf, op);
  const form = doc.getForm();

  for (const [name, value] of Object.entries(values)) {
    let field;
    try {
      field = form.getField(name);
    } catch {
      continue; // unknown field name — skip rather than fail the whole fill
    }
    try {
      if (field instanceof PDFTextField) {
        field.setText(value);
      } else if (field instanceof PDFCheckBox) {
        if (CHECKED.has(value.toLowerCase())) {
          field.check();
        } else {
          field.uncheck();
        }
      } else if (
        field instanceof PDFDropdown ||
        field instanceof PDFOptionList ||
        field instanceof PDFRadioGroup
      ) {
        field.select(value);
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      throw new PdfEngineException(
        `Could not set field "${name}": ${error.message}`,
        'UNSUPPORTED_FORMAT',
        op,
        error,
        { field: name }
      );
    }
  }

  // Bake the filled values into static page content so they render everywhere.
  form.flatten();
  return doc.save();
}
