import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import type { DocumentEntity } from '@/infrastructure/database/types';
import type { UseTrash } from '../../hooks/useTrash';
import { TrashPage } from '../TrashPage';

const trash: UseTrash = {
  items: [],
  loading: false,
  restore: vi.fn(),
  deleteForever: vi.fn(),
  emptyTrash: vi.fn(),
};

vi.mock('../../hooks/useTrash', () => ({ useTrash: () => trash }));

const doc = (id: string, name: string): DocumentEntity =>
  ({ id, name, deletedAt: '2026-07-01T00:00:00.000Z' }) as DocumentEntity;

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 300,
    height: 56,
    top: 0,
    left: 0,
    right: 300,
    bottom: 56,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});

beforeEach(() => {
  trash.items = [];
  trash.loading = false;
  trash.restore = vi.fn();
  trash.deleteForever = vi.fn();
  trash.emptyTrash = vi.fn();
});

afterEach(cleanup);

const q = (id: string): HTMLElement | null =>
  document.querySelector(`[data-agent-id="${id}"]`);

describe('TrashPage (F-57)', () => {
  it('shows the empty state when the trash is empty', () => {
    render(<TrashPage />);
    expect(q('vault.trash.empty')).not.toBeNull();
    expect(screen.getByText('Trash is empty')).toBeInTheDocument();
  });

  it('lists trashed documents with restore + delete controls', () => {
    trash.items = [doc('a', 'PAN Card'), doc('b', 'Aadhaar')];
    render(<TrashPage />);
    expect(screen.getByText('PAN Card')).toBeInTheDocument();
    expect(q('vault.trash.restore.a')).not.toBeNull();
    expect(q('vault.trash.delete.b')).not.toBeNull();
  });

  it('restores a document', () => {
    trash.items = [doc('a', 'PAN Card')];
    render(<TrashPage />);
    fireEvent.click(q('vault.trash.restore.a')!);
    expect(trash.restore).toHaveBeenCalledWith(trash.items[0]);
  });

  it('empties the trash only after an inline confirm', () => {
    trash.items = [doc('a', 'PAN Card')];
    render(<TrashPage />);
    // First click reveals the confirm; it must NOT empty yet.
    fireEvent.click(q('vault.trash.empty')!);
    expect(trash.emptyTrash).not.toHaveBeenCalled();
    fireEvent.click(q('vault.trash.empty-confirm')!);
    expect(trash.emptyTrash).toHaveBeenCalledOnce();
  });

  it('can cancel the empty-trash confirmation', () => {
    trash.items = [doc('a', 'PAN Card')];
    render(<TrashPage />);
    fireEvent.click(q('vault.trash.empty')!);
    fireEvent.click(q('vault.trash.empty-cancel')!);
    expect(trash.emptyTrash).not.toHaveBeenCalled();
    // Back to the plain Empty button.
    expect(q('vault.trash.empty')).not.toBeNull();
  });

  describe('swipe actions (F-88)', () => {
    it('restores on a committed swipe-right', () => {
      trash.items = [doc('a', 'PAN Card')];
      render(<TrashPage />);
      const content = document
        .querySelector('[data-agent-id="vault.trash.item.a.swipe"]')
        ?.querySelector('.kg-swipe-row__content') as Element;
      fireEvent.pointerDown(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
      fireEvent.pointerMove(content, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 50 });
      fireEvent.pointerUp(content, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 50 });
      expect(trash.restore).toHaveBeenCalledWith(trash.items[0]);
      expect(trash.deleteForever).not.toHaveBeenCalled();
    });

    it('deletes forever on a committed swipe-left', () => {
      trash.items = [doc('a', 'PAN Card')];
      render(<TrashPage />);
      const content = document
        .querySelector('[data-agent-id="vault.trash.item.a.swipe"]')
        ?.querySelector('.kg-swipe-row__content') as Element;
      fireEvent.pointerDown(content, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 50 });
      fireEvent.pointerMove(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
      fireEvent.pointerUp(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
      expect(trash.deleteForever).toHaveBeenCalledWith(trash.items[0]);
      expect(trash.restore).not.toHaveBeenCalled();
    });
  });
});
