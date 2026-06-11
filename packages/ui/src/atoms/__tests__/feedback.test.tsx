import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from '../ProgressBar';
import { Spinner } from '../Spinner';
import { agentAttrs } from '../../agent-props';

describe('Spinner', () => {
  it('exposes role="status" with the default label', () => {
    render(<Spinner />);
    expect(screen.getByRole('status', { name: 'Loading...' })).toHaveClass(
      'kg-spinner--md'
    );
  });

  it('accepts size and custom label', () => {
    render(<Spinner size="lg" label="Compressing" />);
    expect(screen.getByRole('status', { name: 'Compressing' })).toHaveClass(
      'kg-spinner--lg'
    );
  });
});

describe('ProgressBar', () => {
  it('exposes progressbar semantics with clamped values', () => {
    render(<ProgressBar value={150} max={100} aria-label="Uploading" />);
    const bar = screen.getByRole('progressbar', { name: 'Uploading' });
    expect(bar).toHaveAttribute('aria-valuenow', '100');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
  });

  it('shows the percentage label when requested', () => {
    render(<ProgressBar value={42} showLabel aria-label="Upload" />);
    expect(screen.getByText('42%')).toBeInTheDocument();
  });

  it('indeterminate drops aria-valuenow and the label', () => {
    render(<ProgressBar indeterminate showLabel aria-label="Working" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).not.toHaveAttribute('aria-valuenow');
    expect(screen.queryByText(/%/)).toBeNull();
    expect(bar).toHaveClass('kg-progress--indeterminate');
  });
});

describe('agentAttrs', () => {
  it('maps props to data attributes, omitting undefined', () => {
    expect(
      agentAttrs(
        { agentId: 'a.b.c', agentAction: 'a.do', agentRole: 'navigation' },
        'idle',
        'v'
      )
    ).toEqual({
      'data-agent-id': 'a.b.c',
      'data-agent-action': 'a.do',
      'data-agent-role': 'navigation',
      'data-agent-state': 'idle',
      'data-agent-value': 'v',
    });
    expect(agentAttrs({})).toEqual({
      'data-agent-id': undefined,
      'data-agent-action': undefined,
      'data-agent-role': undefined,
      'data-agent-state': undefined,
      'data-agent-value': undefined,
    });
  });
});
