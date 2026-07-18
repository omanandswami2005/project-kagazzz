import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Search } from '../Search';

describe('Search', () => {
  it('renders the current value and placeholder', () => {
    render(
      <Search value="report" placeholder="Search documents" onChange={() => undefined} />
    );
    expect(screen.getByRole('searchbox')).toHaveValue('report');
    expect(screen.getByPlaceholderText('Search documents')).toBeInTheDocument();
  });

  it('reports changes and reflects dirty/pristine agent state', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Search value="" onChange={onChange} agentId="vault.home.search" />
    );
    expect(screen.getByRole('searchbox')).toHaveAttribute(
      'data-agent-state',
      'pristine'
    );
    rerender(<Search value="x" onChange={onChange} agentId="vault.home.search" />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('data-agent-state', 'dirty');
  });

  it('typing calls onChange with the new value', async () => {
    const onChange = vi.fn();
    render(<Search value="" onChange={onChange} />);
    await userEvent.type(screen.getByRole('searchbox'), 'x');
    expect(onChange).toHaveBeenCalledWith('x');
  });

  it('shows a clear button only when there is a value, and it clears on tap', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Search value="" onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();

    rerender(<Search value="query" onChange={onChange} />);
    const clearBtn = screen.getByRole('button', { name: 'Clear' });
    await userEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });
});
