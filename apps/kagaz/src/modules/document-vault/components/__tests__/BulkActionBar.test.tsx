import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { BulkActionBar } from '../BulkActionBar';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

describe('BulkActionBar (F-25 + F-65 bulk share)', () => {
  it('hides the Share button when onShare is omitted (e.g. web)', () => {
    render(
      <BulkActionBar
        count={2}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onFavorite={vi.fn()}
      />
    );
    expect(
      document.querySelector('[data-agent-id="vault.home.bulk-share"]')
    ).not.toBeInTheDocument();
  });

  it('shows and wires the Share button when onShare is provided', async () => {
    const onShare = vi.fn();
    render(
      <BulkActionBar
        count={2}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onFavorite={vi.fn()}
        onShare={onShare}
      />
    );
    const button = document.querySelector('[data-agent-id="vault.home.bulk-share"]');
    expect(button).toBeInTheDocument();
    expect(button).not.toHaveAttribute('data-agent-action');
    await userEvent.click(button as HTMLElement);
    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it('disables Share when nothing is selected', () => {
    render(
      <BulkActionBar
        count={0}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onFavorite={vi.fn()}
        onShare={vi.fn()}
      />
    );
    expect(
      document.querySelector('[data-agent-id="vault.home.bulk-share"]')
    ).toBeDisabled();
  });

  it('shows the selection count', () => {
    render(
      <BulkActionBar
        count={3}
        onCancel={vi.fn()}
        onDelete={vi.fn()}
        onMove={vi.fn()}
        onFavorite={vi.fn()}
      />
    );
    expect(screen.getByText('3 selected')).toBeInTheDocument();
  });

  describe('delete confirmation (a Modal, not a bottom sheet — interaction-patterns.md)', () => {
    it('asks for confirmation before calling onDelete', async () => {
      const onDelete = vi.fn();
      render(
        <BulkActionBar
          count={2}
          onCancel={vi.fn()}
          onDelete={onDelete}
          onMove={vi.fn()}
          onFavorite={vi.fn()}
        />
      );
      await userEvent.click(
        document.querySelector('[data-agent-id="vault.home.bulk-delete"]') as HTMLElement
      );
      expect(onDelete).not.toHaveBeenCalled();
      expect(screen.getByText('Delete 2 document(s)?')).toBeInTheDocument();
      await userEvent.click(screen.getByText('Delete'));
      expect(onDelete).toHaveBeenCalledOnce();
    });

    it('does nothing when Cancel is tapped', async () => {
      const onDelete = vi.fn();
      render(
        <BulkActionBar
          count={2}
          onCancel={vi.fn()}
          onDelete={onDelete}
          onMove={vi.fn()}
          onFavorite={vi.fn()}
        />
      );
      await userEvent.click(
        document.querySelector('[data-agent-id="vault.home.bulk-delete"]') as HTMLElement
      );
      const confirm = document.querySelector(
        '[data-agent-id="vault.home.bulk-delete-confirm"]'
      ) as HTMLElement;
      await userEvent.click(within(confirm).getByText('Cancel'));
      expect(onDelete).not.toHaveBeenCalled();
    });
  });
});
