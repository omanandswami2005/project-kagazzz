import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { usePreferencesStore } from '@/core/preferences';
import type { DocumentEntity } from '@/infrastructure/database/types';
import { RecentStrip } from '../RecentStrip';

const doc = (id: string): DocumentEntity =>
  ({ id, name: `Doc ${id}.pdf`, filePath: `documents/${id}.pdf`, fileType: 'pdf' }) as DocumentEntity;

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

beforeEach(() => {
  usePreferencesStore.setState({ recentSectionCollapsed: false });
});

describe('RecentStrip (F-32 + collapse UX pass)', () => {
  it('renders nothing when there are no recent documents', () => {
    const { container } = render(<RecentStrip documents={[]} onOpen={vi.fn()} />);
    expect(container.querySelector('[data-agent-id="vault.home.recent"]')).toBeNull();
  });

  it('shows the row expanded by default', () => {
    render(<RecentStrip documents={[doc('1')]} onOpen={vi.fn()} />);
    expect(document.getElementById('vault-home-recent-row')).toBeInTheDocument();
    expect(
      document.querySelector('[data-agent-id="vault.home.recent-toggle"]')
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('collapses and expands on toggle, persisting the choice', async () => {
    render(<RecentStrip documents={[doc('1')]} onOpen={vi.fn()} />);
    const toggle = document.querySelector<HTMLElement>(
      '[data-agent-id="vault.home.recent-toggle"]'
    )!;

    await userEvent.click(toggle);
    expect(document.getElementById('vault-home-recent-row')).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(usePreferencesStore.getState().recentSectionCollapsed).toBe(true);

    await userEvent.click(toggle);
    expect(document.getElementById('vault-home-recent-row')).toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(usePreferencesStore.getState().recentSectionCollapsed).toBe(false);
  });

  it('starts collapsed when the preference was already persisted', () => {
    usePreferencesStore.setState({ recentSectionCollapsed: true });
    render(<RecentStrip documents={[doc('1')]} onOpen={vi.fn()} />);
    expect(document.getElementById('vault-home-recent-row')).not.toBeInTheDocument();
  });

  it('opens a document on click', async () => {
    const onOpen = vi.fn();
    render(<RecentStrip documents={[doc('1')]} onOpen={onOpen} />);
    await userEvent.click(screen.getByText('Doc 1.pdf'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  describe('swipe-up → Tools (UX-16)', () => {
    it('opens Tools on a committed swipe-up, without opening the document', () => {
      const onOpen = vi.fn();
      const onOpenTools = vi.fn();
      render(<RecentStrip documents={[doc('1')]} onOpen={onOpen} onOpenTools={onOpenTools} />);
      const card = document.querySelector('[data-agent-id="vault.home.recent-1"]') as Element;
      fireEvent.pointerDown(card, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 200 });
      fireEvent.pointerMove(card, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 100 });
      fireEvent.pointerUp(card, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 100 });
      expect(onOpenTools).toHaveBeenCalledOnce();
      expect(onOpen).not.toHaveBeenCalled();
    });

    it('does not open Tools on a short upward drag', () => {
      const onOpenTools = vi.fn();
      render(<RecentStrip documents={[doc('1')]} onOpen={vi.fn()} onOpenTools={onOpenTools} />);
      const card = document.querySelector('[data-agent-id="vault.home.recent-1"]') as Element;
      fireEvent.pointerDown(card, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 200 });
      fireEvent.pointerMove(card, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 190 });
      fireEvent.pointerUp(card, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 190 });
      expect(onOpenTools).not.toHaveBeenCalled();
    });

    it('is a no-op (never throws) when onOpenTools is not supplied', () => {
      render(<RecentStrip documents={[doc('1')]} onOpen={vi.fn()} />);
      const card = document.querySelector('[data-agent-id="vault.home.recent-1"]') as Element;
      expect(() => {
        fireEvent.pointerDown(card, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 200 });
        fireEvent.pointerMove(card, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 100 });
        fireEvent.pointerUp(card, { pointerType: 'touch', pointerId: 1, clientX: 100, clientY: 100 });
      }).not.toThrow();
    });
  });
});
