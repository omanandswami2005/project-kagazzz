import { render, screen } from '@testing-library/react';
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
});
