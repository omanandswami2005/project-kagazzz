import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActionSheet } from '../ActionSheet';

describe('ActionSheet', () => {
  it('is closed and reports collapsed state when isOpen is false', () => {
    const { container } = render(
      <ActionSheet
        isOpen={false}
        buttons={[{ text: 'Delete' }]}
        onDidDismiss={() => undefined}
        agentId="vault.home.item-menu"
      />
    );
    const dialog = container.querySelector('dialog');
    expect(dialog).not.toHaveAttribute('open');
    expect(dialog).toHaveAttribute('data-agent-state', 'collapsed');
  });

  it('opens, shows the header and every button, and reports expanded state', () => {
    const { container } = render(
      <ActionSheet
        isOpen
        header="report.pdf"
        buttons={[{ text: 'Rename' }, { text: 'Delete', role: 'destructive' }]}
        onDidDismiss={() => undefined}
      />
    );
    expect(container.querySelector('dialog')).toHaveAttribute(
      'data-agent-state',
      'expanded'
    );
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete' })
    ).toHaveClass('kg-action-sheet__btn--destructive');
  });

  it('runs the row handler then dismisses on tap', async () => {
    const handler = vi.fn();
    const onDidDismiss = vi.fn();
    render(
      <ActionSheet
        isOpen
        buttons={[{ text: 'Move', handler }]}
        onDidDismiss={onDidDismiss}
      />
    );
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(handler).toHaveBeenCalled();
    expect(onDidDismiss).toHaveBeenCalled();
  });

  it('dismisses on a scrim tap without running any row handler', async () => {
    const handler = vi.fn();
    const onDidDismiss = vi.fn();
    const { container } = render(
      <ActionSheet
        isOpen
        buttons={[{ text: 'Move', handler }]}
        onDidDismiss={onDidDismiss}
      />
    );
    const dialog = container.querySelector('dialog');
    if (!dialog) throw new Error('dialog not rendered');
    await userEvent.click(dialog);
    expect(handler).not.toHaveBeenCalled();
    expect(onDidDismiss).toHaveBeenCalled();
  });
});
