import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from '../EmptyState';
import { ListRow } from '../ListRow';
import { SegmentedControl } from '../SegmentedControl';

describe('EmptyState', () => {
  it('renders title, hint and action with its agent id', () => {
    render(
      <EmptyState
        icon="Star"
        title="Nothing yet"
        hint="Tap the star"
        action={<button type="button">Add</button>}
        agentId="x.empty"
      />
    );
    expect(screen.getByText('Nothing yet')).toBeInTheDocument();
    expect(screen.getByText('Tap the star')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(document.querySelector('[data-agent-id="x.empty"]')).not.toBeNull();
  });
});

describe('SegmentedControl', () => {
  it('marks the selected option and reports changes', () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        aria-label="Theme"
        agentId="s.theme"
        value="light"
        onChange={onChange}
        options={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
        ]}
      />
    );
    expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true');
    const dark = screen.getByRole('button', { name: 'Dark' });
    expect(dark).toHaveAttribute('data-agent-id', 's.theme-dark');
    fireEvent.click(dark);
    expect(onChange).toHaveBeenCalledWith('dark');
  });
});

describe('ListRow', () => {
  it('fires onClick and hides the chevron while loading', () => {
    const onClick = vi.fn();
    const { rerender } = render(
      <ListRow title="Trash" hint="30 days" icon="Trash2" onClick={onClick} agentId="s.trash" />
    );
    fireEvent.click(screen.getByRole('button', { name: /Trash/ }));
    expect(onClick).toHaveBeenCalledOnce();
    rerender(<ListRow title="Trash" loading onClick={onClick} agentId="s.trash" />);
    expect(screen.getByRole('button', { name: /Trash/ })).toBeDisabled();
  });
});
