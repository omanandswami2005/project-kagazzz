import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { PdfDocPicker } from '../PdfDocPicker';

const docs = [
  { id: 'a', name: 'A.pdf' },
  { id: 'b', name: 'B.pdf' },
] as DocumentEntity[];

describe('PdfDocPicker', () => {
  it('shows the empty text when there are no documents', () => {
    render(
      <PdfDocPicker
        documents={[]}
        multi={false}
        selectedIds={[]}
        onChange={vi.fn()}
        emptyText="Nothing here"
      />
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });

  it('single-select replaces the current selection', () => {
    const onChange = vi.fn();
    render(
      <PdfDocPicker
        documents={docs}
        multi={false}
        selectedIds={['a']}
        onChange={onChange}
        emptyText=""
      />
    );
    fireEvent.click(screen.getByText('B.pdf'));
    expect(onChange).toHaveBeenCalledWith(['b']);
  });

  it('single-select toggles off when the selected row is re-tapped', () => {
    const onChange = vi.fn();
    render(
      <PdfDocPicker
        documents={docs}
        multi={false}
        selectedIds={['a']}
        onChange={onChange}
        emptyText=""
      />
    );
    fireEvent.click(screen.getByText('A.pdf'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('multi-select adds to and removes from the selection', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PdfDocPicker
        documents={docs}
        multi
        selectedIds={['a']}
        onChange={onChange}
        emptyText=""
      />
    );
    fireEvent.click(screen.getByText('B.pdf'));
    expect(onChange).toHaveBeenCalledWith(['a', 'b']);

    rerender(
      <PdfDocPicker
        documents={docs}
        multi
        selectedIds={['a', 'b']}
        onChange={onChange}
        emptyText=""
      />
    );
    fireEvent.click(screen.getByText('A.pdf'));
    expect(onChange).toHaveBeenLastCalledWith(['b']);
  });
});
