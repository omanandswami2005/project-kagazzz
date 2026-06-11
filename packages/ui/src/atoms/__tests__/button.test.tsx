import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../Button';

describe('Button', () => {
  it('renders the label and fires onClick', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} agentId="vault.list.scan-btn">
        Scan
      </Button>
    );
    const btn = screen.getByRole('button', { name: 'Scan' });
    await userEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('exposes the agent contract: id, action, role, state', () => {
    render(
      <Button
        agentId="vault.list.scan-btn"
        agentAction="vault.scanDocument"
        agentRole="primary-action"
      >
        Scan
      </Button>
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-agent-id', 'vault.list.scan-btn');
    expect(btn).toHaveAttribute('data-agent-action', 'vault.scanDocument');
    expect(btn).toHaveAttribute('data-agent-role', 'primary-action');
    expect(btn).toHaveAttribute('data-agent-state', 'idle');
  });

  it('derives data-agent-state from disabled and loading', () => {
    const { rerender } = render(<Button disabled>Save</Button>);
    expect(screen.getByRole('button')).toHaveAttribute(
      'data-agent-state',
      'disabled'
    );
    rerender(<Button loading>Save</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('data-agent-state', 'loading');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('applies variant/size/fullWidth classes', () => {
    render(
      <Button variant="danger" size="lg" fullWidth>
        Delete
      </Button>
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('kg-btn--danger', 'kg-btn--lg', 'kg-btn--full');
  });

  it('icon-only renders with aria-label and no text label span', () => {
    render(
      <Button iconOnly aria-label="Close" icon={<svg data-testid="x" />} />
    );
    const btn = screen.getByRole('button', { name: 'Close' });
    expect(btn).toHaveClass('kg-btn--icon-only');
    expect(btn.querySelector('.kg-btn__label')).toBeNull();
  });
});
