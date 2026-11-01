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

const push = vi.fn();

vi.mock('../../hooks/useTrash', () => ({ useTrash: () => trash }));
// useIonRouter() throws "An Ionic Router is required" without a real
// IonReactRouter ancestor, which this lightweight page test doesn't
// provide — same pattern as DocumentViewerPage.test.tsx.
vi.mock('@ionic/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ionic/react')>();
  return { ...actual, useIonRouter: () => ({ push }) };
});

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
  push.mockClear();
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

  it('bug-audit fix: delete-forever button requires confirmation before deleting', () => {
    trash.items = [doc('a', 'PAN Card')];
    render(<TrashPage />);
    fireEvent.click(q('vault.trash.delete.a')!);
    expect(trash.deleteForever).not.toHaveBeenCalled();
    fireEvent.click(q('vault.trash.delete-forever-confirm')!.querySelector('.kg-alert__btn--destructive')!);
    expect(trash.deleteForever).toHaveBeenCalledWith(trash.items[0]);
  });

  it('bug-audit fix: cancelling the delete-forever confirmation does not delete', () => {
    trash.items = [doc('a', 'PAN Card')];
    render(<TrashPage />);
    fireEvent.click(q('vault.trash.delete.a')!);
    fireEvent.click(q('vault.trash.delete-forever-confirm')!.querySelector('.kg-alert__btn--cancel')!);
    expect(trash.deleteForever).not.toHaveBeenCalled();
  });

  it('tapping a row previews it read-only via /doc/:id?trashed=1 (F-57 device-testing follow-up)', () => {
    trash.items = [doc('a', 'PAN Card')];
    render(<TrashPage />);
    expect(q('vault.trash.preview.a')).not.toBeNull();
    fireEvent.click(q('vault.trash.preview.a')!);
    expect(push).toHaveBeenCalledWith('/doc/a?trashed=1');
    // Preview is non-destructive: restore/delete-forever must not fire.
    expect(trash.restore).not.toHaveBeenCalled();
    expect(trash.deleteForever).not.toHaveBeenCalled();
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

    it('bug-audit fix: a committed swipe-left asks for confirmation instead of deleting immediately', () => {
      trash.items = [doc('a', 'PAN Card')];
      render(<TrashPage />);
      const content = document
        .querySelector('[data-agent-id="vault.trash.item.a.swipe"]')
        ?.querySelector('.kg-swipe-row__content') as Element;
      fireEvent.pointerDown(content, { pointerType: 'touch', pointerId: 1, clientX: 200, clientY: 50 });
      fireEvent.pointerMove(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
      fireEvent.pointerUp(content, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 50 });
      expect(trash.deleteForever).not.toHaveBeenCalled();
      expect(trash.restore).not.toHaveBeenCalled();
      fireEvent.click(q('vault.trash.delete-forever-confirm')!.querySelector('.kg-alert__btn--destructive')!);
      expect(trash.deleteForever).toHaveBeenCalledWith(trash.items[0]);
    });
  });
});
