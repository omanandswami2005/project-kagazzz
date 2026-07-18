/**
 * Selectable list of vault documents for a PDF operation. Single-select for
 * most ops, multi-select for merge / images → PDF.
 */
import type { ReactNode } from 'react';
import { Icon } from '@kagaz/ui';
import type { DocumentEntity } from '@/infrastructure/database/types';

/** Props for {@link PdfDocPicker}. */
export interface PdfDocPickerProps {
  documents: DocumentEntity[];
  /** Allow selecting more than one document. */
  multi: boolean;
  /** Currently-selected document ids. */
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Shown when no documents match the operation's input type. */
  emptyText: string;
  /**
   * Agent-id prefix for this picker's elements. Defaults to the main picker;
   * a second picker on the same sheet (e.g. F-38 stamp's image list) passes a
   * distinct prefix so agent ids stay unique.
   */
  idPrefix?: string;
}

/** A list of documents the user taps to select. */
export function PdfDocPicker({
  documents,
  multi,
  selectedIds,
  onChange,
  emptyText,
  idPrefix = 'pdf-tools.picker',
}: PdfDocPickerProps): ReactNode {
  if (documents.length === 0) {
    return (
      <p className="kg-pdf-picker__empty" data-agent-id={`${idPrefix}.empty`}>
        {emptyText}
      </p>
    );
  }

  const toggle = (id: string): void => {
    if (multi) {
      onChange(
        selectedIds.includes(id)
          ? selectedIds.filter((x) => x !== id)
          : [...selectedIds, id]
      );
    } else {
      onChange(selectedIds[0] === id ? [] : [id]);
    }
  };

  return (
    <ul className="kg-pdf-picker" data-agent-id={idPrefix}>
      {documents.map((doc) => {
        const selected = selectedIds.includes(doc.id);
        return (
          <li key={doc.id}>
            <button
              type="button"
              className="kg-pdf-picker__row"
              onClick={() => toggle(doc.id)}
              data-agent-id={`${idPrefix}.item-${doc.id}`}
              data-agent-state={selected ? 'selected' : 'idle'}
              aria-pressed={selected}
            >
              <span
                className="kg-pdf-picker__check"
                data-checked={selected ? 'true' : 'false'}
                aria-hidden
              >
                {selected && <Icon name="Check" size={16} />}
              </span>
              <span className="kg-pdf-picker__name">{doc.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
