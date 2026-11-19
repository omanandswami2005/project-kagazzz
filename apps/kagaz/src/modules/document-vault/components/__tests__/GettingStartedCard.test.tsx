import userEvent from '@testing-library/user-event';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { i18n, initI18n } from '@/core/i18n';
import { GettingStartedCard, type GettingStartedItem } from '../GettingStartedCard';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});

function items(done: GettingStartedItem['id'][], onStart = vi.fn()): GettingStartedItem[] {
  return (['add', 'folder', 'star', 'lock', 'backup'] as const).map((id) => ({
    id,
    icon: 'Star',
    done: done.includes(id),
    onStart,
  }));
}

describe('GettingStartedCard (first-run journey)', () => {
  it('shows progress from real state and starts an unfinished item', async () => {
    const onStart = vi.fn();
    render(<GettingStartedCard items={items(['add', 'star'], onStart)} onDismiss={vi.fn()} />);
    expect(screen.getAllByText('2 of 5 done').length).toBeGreaterThan(0);
    await userEvent.click(document.querySelector('[data-agent-id="vault.home.getting-started.folder"]') as Element);
    expect(onStart).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-agent-id="vault.home.getting-started.add"]')?.closest('li')).toHaveAttribute(
      'data-agent-state',
      'success'
    );
  });

  it('disappears once everything is done, and can be dismissed', async () => {
    const { container, rerender } = render(
      <GettingStartedCard items={items(['add', 'folder', 'star', 'lock', 'backup'])} onDismiss={vi.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
    const onDismiss = vi.fn();
    rerender(<GettingStartedCard items={items(['add'])} onDismiss={onDismiss} />);
    await userEvent.click(document.querySelector('[data-agent-id="vault.home.getting-started.dismiss"]') as Element);
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
