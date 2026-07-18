import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Checkbox } from '../Checkbox';
import { Input } from '../Input';
import { Radio } from '../Radio';
import { Select } from '../Select';
import { Toggle } from '../Toggle';

describe('Input', () => {
  it('associates label and reports changes', async () => {
    const onChange = vi.fn();
    render(<Input label="Name" value="" onChange={onChange} />);
    const field = screen.getByLabelText('Name');
    await userEvent.type(field, 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('renders error with aria-invalid and aria-describedby', () => {
    render(<Input label="PAN" value="x" error="Invalid PAN" />);
    const field = screen.getByLabelText('PAN');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Invalid PAN')).toBeInTheDocument();
    expect(field).toHaveAttribute('data-agent-state', 'error');
  });

  it('renders helper text when no error', () => {
    render(<Input label="Name" value="" helperText="As per Aadhaar" />);
    expect(screen.getByText('As per Aadhaar')).toBeInTheDocument();
  });

  it('reflects value in data-agent-value except for passwords', () => {
    const { rerender } = render(
      <Input label="Email" value="a@b.in" agentId="auth.login.email" />
    );
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'data-agent-value',
      'a@b.in'
    );
    rerender(
      <Input
        label="PIN"
        type="password"
        value="secret"
        agentId="auth.login.pin"
      />
    );
    expect(screen.getByLabelText('PIN')).not.toHaveAttribute(
      'data-agent-value'
    );
  });

  it('moves pristine → dirty after first change', async () => {
    function Wrapper(): React.ReactNode {
      const [v, setV] = React.useState('');
      return <Input label="Name" value={v} onChange={setV} />;
    }
    render(<Wrapper />);
    const field = screen.getByLabelText('Name');
    expect(field).toHaveAttribute('data-agent-state', 'pristine');
    await userEvent.type(field, 'k');
    expect(field).toHaveAttribute('data-agent-state', 'dirty');
  });
});

describe('Checkbox', () => {
  it('toggles and exposes state', async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Select all" onChange={onChange} />);
    const box = screen.getByRole('checkbox', { name: 'Select all' });
    expect(box).toHaveAttribute('data-agent-state', 'idle');
    expect(box).toHaveAttribute('data-agent-value', 'false');
    await userEvent.click(box);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('supports indeterminate with aria-checked="mixed"', () => {
    render(<Checkbox label="Parent" indeterminate />);
    const box = screen.getByRole('checkbox');
    expect(box).toHaveAttribute('aria-checked', 'mixed');
    expect(box).toHaveAttribute('data-agent-state', 'selected');
    expect(box).toHaveAttribute('data-agent-value', 'mixed');
    expect((box as HTMLInputElement).indeterminate).toBe(true);
  });
});

describe('Radio', () => {
  it('selects within a named group and reports its value', async () => {
    const onChange = vi.fn();
    render(
      <div role="radiogroup" aria-label="Language">
        <Radio name="lang" value="hi" label="हिन्दी" onChange={onChange} />
        <Radio name="lang" value="en" label="English" checked />
      </div>
    );
    await userEvent.click(screen.getByRole('radio', { name: 'हिन्दी' }));
    expect(onChange).toHaveBeenCalledWith('hi');
    expect(screen.getByRole('radio', { name: 'English' })).toHaveAttribute(
      'data-agent-state',
      'selected'
    );
  });
});

describe('Toggle', () => {
  it('uses role="switch" with aria-checked and flips on click', async () => {
    const onChange = vi.fn();
    render(<Toggle label="Dark mode" enabled={false} onChange={onChange} />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    expect(sw).toHaveAttribute('data-agent-state', 'idle');
    expect(sw).toHaveAttribute('data-agent-value', 'false');
    await userEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('shows on state and disables', () => {
    render(<Toggle label="Lock" enabled disabled />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).toBeDisabled();
    expect(sw).toHaveAttribute('data-agent-state', 'disabled');
  });
});

describe('Select', () => {
  const options = [
    { value: 'name', label: 'Name' },
    { value: 'date', label: 'Date added' },
    { value: 'size', label: 'File size' },
  ];

  it('shows the current option label and reports changes via the native control', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <Select
        value="name"
        options={options}
        onChange={onChange}
        aria-label="Sort by"
      />
    );
    expect(container.querySelector('.kg-select__value')).toHaveTextContent('Name');
    const native = screen.getByLabelText('Sort by');
    await userEvent.selectOptions(native, 'size');
    expect(onChange).toHaveBeenCalledWith('size');
  });

  it('exposes the agent contract: id, state, value', () => {
    render(
      <Select
        value="date"
        options={options}
        onChange={() => undefined}
        aria-label="Sort by"
        agentId="vault.home.sort-key"
        agentAction="vault.setSortBy"
      />
    );
    const native = screen.getByLabelText('Sort by');
    const wrapper = native.closest('[data-agent-id="vault.home.sort-key"]');
    expect(wrapper).toHaveAttribute('data-agent-action', 'vault.setSortBy');
    expect(wrapper).toHaveAttribute('data-agent-state', 'idle');
    expect(wrapper).toHaveAttribute('data-agent-value', 'date');
  });

  it('is disabled via both the wrapper and the native control', () => {
    render(
      <Select
        value="name"
        options={options}
        onChange={() => undefined}
        aria-label="Sort by"
        disabled
      />
    );
    expect(screen.getByLabelText('Sort by')).toBeDisabled();
    expect(screen.getByLabelText('Sort by').closest('.kg-select')).toHaveAttribute(
      'data-agent-state',
      'disabled'
    );
  });
});
