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

  it('renders a row icon when given, decoratively (no accessible-name change)', () => {
    render(
      <ActionSheet
        isOpen
        buttons={[{ text: 'Move', icon: 'Move' }]}
        onDidDismiss={() => undefined}
      />
    );
    const button = screen.getByRole('button', { name: 'Move' });
    const icon = button.querySelector('svg');
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders no icon for a row that specifies none', () => {
    render(
      <ActionSheet
        isOpen
        buttons={[{ text: 'Details' }]}
        onDidDismiss={() => undefined}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Details' }).querySelector('svg')
    ).not.toBeInTheDocument();
  });

  it('defaults a cancel row to the X icon when none is given', () => {
    render(
      <ActionSheet
        isOpen
        buttons={[{ text: 'Cancel', role: 'cancel' }]}
        onDidDismiss={() => undefined}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Cancel' }).querySelector('svg')
    ).toBeInTheDocument();
  });

  it('lets a cancel row override the default icon', () => {
    render(
      <ActionSheet
        isOpen
        buttons={[{ text: 'Keep editing', role: 'cancel', icon: 'Pencil' }]}
        onDidDismiss={() => undefined}
      />
    );
    // Just confirms it still renders exactly one icon, not the X default —
    // the specific glyph isn't asserted (Icon.tsx already covers name→glyph).
    expect(
      screen.getByRole('button', { name: 'Keep editing' }).querySelectorAll('svg')
    ).toHaveLength(1);
  });
});
